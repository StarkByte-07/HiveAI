export class PerformanceTimer {
  private starts: Map<string, number> = new Map();

  start(label: string): void {
    this.starts.set(label, Date.now());
  }

  end(label: string): number {
    const startTime = this.starts.get(label);
    const duration = startTime ? Date.now() - startTime : 0;
    this.starts.delete(label);
    console.log(`[TIMING] ${label}: ${duration}ms`);
    return duration;
  }

  log(label: string, durationMs: number): void {
    console.log(`[TIMING] ${label}: ${Math.round(durationMs)}ms`);
  }
}

export const perfTimer = new PerformanceTimer();
