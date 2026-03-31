<?php

namespace Pterodactyl\Tests\Integration\Listeners;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Pterodactyl\Jobs\MirrorServerActivityToDiscordJob;
use Pterodactyl\Models\ActivityLog;
use Pterodactyl\Models\User;
use Pterodactyl\Tests\Integration\IntegrationTestCase;

class ServerActivityDiscordListenerTest extends IntegrationTestCase
{
    public function test_it_mirrors_server_activity_to_discord(): void
    {
        $webhook = 'https://discord.com/api/webhooks/test/token';

        config()->set('pterodactyl.activity.discord.webhook', $webhook);
        config()->set('pterodactyl.activity.discord.username_template', 'Starling | {{server.name}}');

        /** @var User $actor */
        $actor = User::factory()->create(['username' => 'dody']);
        $server = $this->createServerModel(['name' => 'Lobby']);

        /** @var ActivityLog $activity */
        $activity = ActivityLog::query()->create([
            'event' => 'server:power.start',
            'ip' => '127.0.0.1',
            'actor_type' => $actor->getMorphClass(),
            'actor_id' => $actor->id,
            'properties' => ['signal' => 'start'],
            'timestamp' => now(),
        ]);

        $activity->subjects()->create([
            'subject_type' => $server->getMorphClass(),
            'subject_id' => $server->id,
        ]);

        Http::fake([$webhook => Http::response('', 204)]);

        $job = new MirrorServerActivityToDiscordJob($activity->id);
        $job->handle();

        Http::assertSent(function (Request $request) use ($webhook, $server) {
            $payload = $request->data();

            return $request->url() === $webhook
                && $payload['username'] === 'Starling | Lobby'
                && $payload['allowed_mentions']['parse'] === []
                && $payload['embeds'][0]['description'] === 'Started the server'
                && $payload['embeds'][0]['fields'][1]['value'] === 'dody'
                && str_contains($payload['embeds'][0]['fields'][2]['value'], $server->identifier);
        });
    }

    public function test_it_ignores_non_server_activity(): void
    {
        config()->set('pterodactyl.activity.discord.webhook', 'https://discord.com/api/webhooks/test/token');

        /** @var ActivityLog $activity */
        $activity = ActivityLog::query()->create([
            'event' => 'user:account.password-changed',
            'ip' => '127.0.0.1',
            'properties' => [],
            'timestamp' => now(),
        ]);

        Http::fake();

        $job = new MirrorServerActivityToDiscordJob($activity->id);
        $job->handle();

        Http::assertNothingSent();
    }
}
