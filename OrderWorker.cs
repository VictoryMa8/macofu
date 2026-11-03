namespace Macofu;

public sealed class OrderWorker(LearnerLabs learners) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(700));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            // A request can return while this independent consumer is paused.
            learners.ProcessNext();
        }
    }
}
