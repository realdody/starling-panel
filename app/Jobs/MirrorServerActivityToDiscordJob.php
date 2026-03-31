<?php

namespace Pterodactyl\Jobs;

use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Lang;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Pterodactyl\Models\ActivityLog;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;

class MirrorServerActivityToDiscordJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $maxExceptions = 1;

    public function __construct(public readonly int $activityLogId)
    {
    }

    public function handle(): void
    {
        $webhook = config('pterodactyl.activity.discord.webhook');
        if (!is_string($webhook) || $webhook === '') {
            return;
        }

        $activity = ActivityLog::query()
            ->with(['actor', 'subjects.subject'])
            ->find($this->activityLogId);

        if (!$activity instanceof ActivityLog || in_array($activity->event, ActivityLog::DISABLED_EVENTS, true)) {
            return;
        }

        $server = $this->extractServer($activity);
        if (!$server instanceof Server) {
            return;
        }

        try {
            $response = Http::asJson()
                ->timeout((int) config('pterodactyl.activity.discord.timeout', 3))
                ->post($webhook, $this->buildPayload($activity, $server));

            if (!$response->successful()) {
                Log::warning('Failed to mirror server activity log to Discord webhook.', [
                    'activity_log_id' => $activity->id,
                    'server_id' => $server->id,
                    'status' => $response->status(),
                ]);
            }
        } catch (\Throwable $exception) {
            Log::warning('Failed to mirror server activity log to Discord webhook.', [
                'activity_log_id' => $activity->id,
                'server_id' => $server->id,
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    protected function extractServer(ActivityLog $activity): ?Server
    {
        foreach ($activity->subjects as $subject) {
            if ($subject->subject instanceof Server) {
                return $subject->subject;
            }
        }

        return null;
    }

    protected function buildPayload(ActivityLog $activity, Server $server): array
    {
        $properties = $this->flattenProperties($activity->properties?->toArray() ?? []);
        $metadata = $this->formatMetadata($activity->properties?->toArray() ?? []);

        $fields = [
            [
                'name' => 'Event',
                'value' => Str::limit("`{$activity->event}`", 1024, ''),
                'inline' => true,
            ],
            [
                'name' => 'Actor',
                'value' => $activity->actor instanceof User ? $activity->actor->username : 'System',
                'inline' => true,
            ],
            [
                'name' => 'Server',
                'value' => Str::limit("{$server->name}\n`{$server->identifier}`", 1024, ''),
                'inline' => true,
            ],
        ];

        if (!is_null($metadata)) {
            $fields[] = [
                'name' => 'Metadata',
                'value' => $metadata,
                'inline' => false,
            ];
        }

        return [
            'username' => $this->renderUsername($server),
            'allowed_mentions' => ['parse' => []],
            'embeds' => [[
                'title' => 'Server Activity',
                'description' => Str::limit($this->translateActivity($activity, $properties), 4096, ''),
                'color' => 5793266,
                'timestamp' => $activity->timestamp->toIso8601String(),
                'fields' => $fields,
            ]],
        ];
    }

    protected function renderUsername(Server $server): string
    {
        $template = config('pterodactyl.activity.discord.username_template', '{{server.name}}');
        $template = is_string($template) && trim($template) !== '' ? $template : '{{server.name}}';

        $username = strtr($template, [
            '{{server.id}}' => (string) $server->id,
            '{{server.name}}' => $server->name,
            '{{server.uuid}}' => $server->uuid,
            '{{server.uuid_short}}' => $server->uuidShort,
            '{{server.identifier}}' => $server->identifier,
        ]);

        $username = trim($username);

        return Str::limit($username !== '' ? $username : $server->name, 80, '');
    }

    protected function translateActivity(ActivityLog $activity, array $properties): string
    {
        $key = 'activity.' . str_replace(':', '.', $activity->event);
        $count = max(1, (int) ($properties['count'] ?? 1));
        $pluralKey = sprintf('%s_%s', $key, $count === 1 ? 'one' : 'other');

        if (Lang::has($pluralKey)) {
            return __($pluralKey, $properties);
        }

        $line = Lang::get($key);

        if (is_array($line)) {
            return trans_choice($key, $count, $properties);
        }

        if (is_string($line) && $line !== $key) {
            return __($key, $properties);
        }

        return $activity->description ?: $activity->event;
    }

    protected function flattenProperties(array $properties): array
    {
        $flattened = [];
        $counts = [];

        foreach ($properties as $key => $value) {
            if ($key === 'directory' && is_string($value)) {
                $value = str_replace('//', '/', '/' . trim($value, '/') . '/');
            }

            if (!is_array($value)) {
                $flattened[$key] = $this->normalizeValue($value);
                continue;
            }

            $counts[$key] = count($value);
            foreach (Arr::dot([$key => $value]) as $dotKey => $dotValue) {
                $flattened[$dotKey] = $this->normalizeValue($dotValue);
            }
        }

        foreach ($counts as $key => $count) {
            $flattened["{$key}_count"] = $count;
        }

        if (count($counts) === 1) {
            $flattened['count'] = reset($counts);
        }

        return $flattened;
    }

    protected function formatMetadata(array $properties): ?string
    {
        unset($properties['ip'], $properties['useragent']);

        if ($properties === []) {
            return null;
        }

        $encoded = json_encode($properties, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            return null;
        }

        return "```json\n" . Str::limit($encoded, 980, '') . "\n```";
    }

    protected function normalizeValue(mixed $value): mixed
    {
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_null($value)) {
            return 'null';
        }

        return $value;
    }
}
