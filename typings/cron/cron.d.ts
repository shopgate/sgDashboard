declare module "cron" {
    class CronJob {
        constructor (cronTime: string, onTick: () => any, onComplete?: () => any,
            start?: boolean, timezone?: string, context?: any);
        constructor (cronTime: Date, onTick: () => any, onComplete?: () => any,
            start?: boolean, timezone?: string, context?: any);

        start();
        stop();
    }
}

