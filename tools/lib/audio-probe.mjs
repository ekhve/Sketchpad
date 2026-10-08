/* Page-side helpers for the sound checks. They run inside the page (via addInitScript), so they are plain
   functions that are turned into source with .toString(). (D-103)

   tap()               records the loudest sample sent to the speakers, in window.__peak.
   strictAudio(mode)   makes AudioContext behave like a phone's: it starts suspended, and resume() is honoured
                       only inside an event that counts as a touch. The modes are the readings of the rule
                       that have to be survived, because only a phone says which one iOS applies:
                         "release"  touchend / pointerup / click / keydown count
                         "click"    only click and keydown count (a touch whose events were cancelled gives no click
                                    but a plain tap does)
                       and, for a resume() outside such an event, either it stays pending until the next
                       counting event ("retro") or it is lost for good ("lost"). */
export function tap() {
  window.__peak = 0;
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const out = connect.call(this, dest, ...rest);
    try {
      const ctx = this.context;
      if (dest === ctx.destination && !this.__tapped) {
        this.__tapped = true;
        const an = ctx.createAnalyser(); an.fftSize = 2048; connect.call(this, an);
        const buf = new Float32Array(an.fftSize);
        setInterval(() => { an.getFloatTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v)); if (m > window.__peak) window.__peak = m; }, 20);
      }
    } catch (e) {}
    return out;
  };
}

export function strictAudio({ counts, pending }) {
  window.__resumes = []; window.__ctxs = [];
  let active = false; const queue = [];
  const open = (name) => { active = true; const q = queue.splice(0); if (pending === "retro") q.forEach((f) => f()); window.__resumes.push(name + (q.length ? ` (released ${q.length})` : "")); setTimeout(() => { active = false; }, 0); };
  for (const type of counts) window.addEventListener(type, () => { active = true; if (pending === "retro") queue.splice(0).forEach((f) => f()); setTimeout(() => { active = false; }, 0); }, true);
  const Native = window.AudioContext;
  class Strict extends Native {
    constructor(...a) { super(...a); window.__ctxs.push(this); Native.prototype.suspend.call(this); this.__user = false; }
    resume() {
      if (active) { window.__resumes.push("ok"); return super.resume(); }
      window.__resumes.push("refused");
      return new Promise((resolve) => { if (pending === "retro") queue.push(() => super.resume().then(resolve)); });
    }
  }
  window.AudioContext = Strict; window.webkitAudioContext = Strict;
}
