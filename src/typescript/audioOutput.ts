// audioOutput.ts - Audio output routing UI (speaker / earpiece / bluetooth / headphones)
//
// Backed by media.ts, which owns the per-peer AudioContexts that actually carry remote
// audio and does the real setSinkId work. This module is just the button + popup menu.
import { isAudioOutputSwitchingSupported, setAudioOutputDevice, getStoredAudioOutputId } from './media.js';
import { showToast } from './toast.js';
import { AudioOutputOption, AudioRouteKind } from '../types/index.js';

const ROUTE_ICONS: Record<AudioRouteKind, string> = {
  speaker: '🔊',
  earpiece: '📞',
  bluetooth: '🎧',
  headphones: '🎧',
  default: '🔈'
};

let toggleBtn: HTMLButtonElement | null = null;
let menuEl: HTMLElement | null = null;

function classifyAudioOutputDevice(label: string): AudioRouteKind {
  const l = (label || '').toLowerCase();
  if (!l || l.includes('default') || l.includes('communications')) return 'default';
  if (/bluetooth|airpods|hands-?free/.test(l)) return 'bluetooth';
  if (/earpiece|receiver/.test(l)) return 'earpiece';
  if (/speakerphone|speaker/.test(l)) return 'speaker';
  if (/headphone|headset|wired|line|aux/.test(l)) return 'headphones';
  return 'default';
}

async function listAudioOutputOptions(): Promise<AudioOutputOption[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(d => d.kind === 'audiooutput')
      .map((d, idx) => ({
        id: d.deviceId,
        label: d.label || `Audio Output ${idx + 1}`,
        kind: classifyAudioOutputDevice(d.label)
      }));
  } catch (e) {
    console.warn('Failed to enumerate audio output devices:', e);
    return [];
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateToggleIcon(kind: AudioRouteKind): void {
  if (toggleBtn) toggleBtn.textContent = `${ROUTE_ICONS[kind]} Audio Output`;
}

function closeMenu(): void {
  menuEl?.classList.add('hidden');
}

function isMenuOpen(): boolean {
  return !!menuEl && !menuEl.classList.contains('hidden');
}

async function openMenu(): Promise<void> {
  if (!menuEl || !toggleBtn) return;

  const devices = await listAudioOutputOptions();
  const selectedId = getStoredAudioOutputId();
  const options: AudioOutputOption[] = [
    { id: '', label: 'System Default', kind: 'default' },
    ...devices.filter(d => d.id) // avoid duplicating the default entry
  ];

  menuEl.innerHTML = options.map(option => `
    <button type="button" class="audio-output-item${option.id === selectedId ? ' active' : ''}"
      data-device-id="${escapeHtml(option.id)}" data-kind="${option.kind}">
      <span class="icon">${ROUTE_ICONS[option.kind]}</span>
      <span class="label">${escapeHtml(option.label)}</span>
      ${option.id === selectedId ? '<span class="check">✓</span>' : ''}
    </button>
  `).join('');

  const rect = toggleBtn.getBoundingClientRect();
  const menuWidth = 260;
  menuEl.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8))}px`;
  menuEl.style.top = `${rect.bottom + 6}px`;
  menuEl.classList.remove('hidden');
}

async function handleMenuClick(event: Event): Promise<void> {
  const target = (event.target as HTMLElement).closest('.audio-output-item') as HTMLButtonElement | null;
  if (!target) return;
  const deviceId = target.dataset.deviceId || '';
  const kind = (target.dataset.kind || 'default') as AudioRouteKind;
  closeMenu();
  try {
    await setAudioOutputDevice(deviceId);
    updateToggleIcon(kind);
    showToast('Success', `Audio output switched to ${target.querySelector('.label')?.textContent}`);
  } catch (e) {
    console.error('Failed to switch audio output:', e);
    showToast('Error', 'Unable to switch audio output');
  }
}

export function initializeAudioOutput(): void {
  toggleBtn = document.getElementById('audioOutputToggle') as HTMLButtonElement | null;
  if (!toggleBtn) return;

  if (!isAudioOutputSwitchingSupported()) {
    // No standard way to route call audio on this browser (e.g. iOS Safari). The OS/browser
    // still handles output switching itself (Control Center, Bluetooth auto-connect, etc.),
    // so there's nothing useful for this control to do here.
    toggleBtn.style.display = 'none';
    return;
  }

  menuEl = document.createElement('div');
  menuEl.id = 'audioOutputMenu';
  menuEl.className = 'audio-output-menu hidden';
  document.body.appendChild(menuEl);

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isMenuOpen()) closeMenu(); else openMenu();
  });

  menuEl.addEventListener('click', handleMenuClick);

  document.addEventListener('click', (e) => {
    if (isMenuOpen() && menuEl && !menuEl.contains(e.target as Node) && e.target !== toggleBtn) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  navigator.mediaDevices?.addEventListener?.('devicechange', () => {
    if (isMenuOpen()) openMenu();
  });

  // Reflect a previously chosen route in the button icon as soon as we can identify it.
  const storedId = getStoredAudioOutputId();
  if (storedId) {
    listAudioOutputOptions().then(devices => {
      const match = devices.find(d => d.id === storedId);
      if (match) updateToggleIcon(match.kind);
    });
  }
}
