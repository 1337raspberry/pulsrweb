// The seek bar over the status line while the visitor's own files play: how far in the
// file is, a bar to drag, and how long the file is. `onSeek(seconds)` gets where the bar
// was moved to.
const $ = (id) => document.getElementById(id);

// Seconds as m:ss, or h:mm:ss from an hour up.
export function clock(seconds) {
  const whole = Math.max(0, Math.floor(seconds || 0));
  const two = (n) => String(n).padStart(2, '0');
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  return hours > 0 ? `${hours}:${two(minutes)}:${two(whole % 60)}` : `${minutes}:${two(whole % 60)}`;
}

export function createTransport({ onSeek }) {
  const bar = $('seek');
  // Set while the bar is being dragged, so the file's own progress does not pull it back.
  let dragging = false;

  function paint(time, duration) {
    $('elapsed').textContent = clock(time);
    $('length').textContent = duration > 0 ? clock(duration) : '-:--';
    bar.style.setProperty('--at', `${duration > 0 ? Math.min(100, (time / duration) * 100) : 0}%`);
  }

  // Shows where the file is: `now` is { time, duration } in seconds, or null to hide the bar.
  function update(now) {
    $('transport').hidden = !now;
    if (!now || dragging) return;
    bar.max = String(now.duration || 1);
    bar.disabled = now.duration === 0;
    bar.value = String(now.time);
    paint(now.time, now.duration);
  }

  bar.addEventListener('pointerdown', () => (dragging = true));
  bar.addEventListener('input', () => {
    paint(Number(bar.value), Number(bar.max));
    onSeek(Number(bar.value));
  });
  // Let go: the keys go back to the page rather than nudging the bar.
  bar.addEventListener('change', () => {
    dragging = false;
    bar.blur();
  });
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, () => (dragging = false));

  return { update };
}
