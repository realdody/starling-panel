<?php

namespace Pterodactyl\Listeners;

use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Events\Dispatcher;
use Pterodactyl\Events\ActivityLogged;
use Pterodactyl\Jobs\MirrorServerActivityToDiscordJob;
use Pterodactyl\Extensions\Illuminate\Events\Contracts\SubscribesToEvents;

class ServerActivityDiscordListener implements SubscribesToEvents
{
    public function handle(ActivityLogged $event): void
    {
        $webhook = config('pterodactyl.activity.discord.webhook');
        if (!is_string($webhook) || $webhook === '' || !$event->isServerEvent()) {
            return;
        }

        DB::afterCommit(fn () => MirrorServerActivityToDiscordJob::dispatch($event->model->id));
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen(ActivityLogged::class, [self::class, 'handle']);
    }
}
