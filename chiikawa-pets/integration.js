(() => {
  // The build embeds the supplied ESM engine and local PNG poses for file:// use.
  __PET_ENGINE__
  const spriteSources = JSON.parse(document.getElementById('pet-sprites').textContent);
  const characterProfiles = JSON.parse(document.getElementById('pet-profiles').textContent);
  const toggle = document.getElementById('pet-toggle');
  const picker = document.getElementById('mobile-pets');
  const groups = {
    new: ['shisa', 'momonga', 'rakko'],
    original: ['chiikawa', 'hachiware', 'usagi'],
    all: ['chiikawa', 'hachiware', 'usagi', 'shisa', 'momonga', 'rakko'],
  };
  const preferenceKey = 'jlpt-pet-mobile-group-v1';
  try { const saved = localStorage.getItem(preferenceKey); if (Object.hasOwn(groups, saved)) picker.value = saved; } catch (_) {}
  let pets;
  function syncToggle() {
    const paused = pets.isPaused();
    toggle.textContent = paused ? '캐릭터 움직이기' : '움직임 멈추기';
    toggle.setAttribute('aria-pressed', String(paused));
  }
  function mount() {
    const mobile = groups[picker.value];
    pets = mountChiikawaPets({ spriteSources, characterProfiles, enabledCharacters: groups.all,
      maxVisibleMobile: mobile.length, mobilePriority: mobile });
    syncToggle();
  }
  toggle.addEventListener('click', () => {
    if (pets.isPaused()) pets.resume(); else pets.pause();
    syncToggle();
  });
  picker.addEventListener('change', () => {
    pets.setMobileCharacters(groups[picker.value]);
    try { localStorage.setItem(preferenceKey, picker.value); } catch (_) {}
  });
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  motionQuery.addEventListener('change', syncToggle);
  window.addEventListener('pagehide', () => pets.destroy());
  window.addEventListener('pageshow', event => { if (event.persisted) mount(); });
  mount();
})();
