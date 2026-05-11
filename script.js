    /* ════════════════════════════════
       SUPABASE CONFIG
       ── Ganti nilai di bawah dengan Project URL & Anon Key dari dashboard Supabase kamu
       ── https://supabase.com → Settings → API
    ════════════════════════════════ */
    const SUPABASE_URL  = 'https://koyyvswptpnbvnhaxxqo.supabase.co';   // ← ganti ini
    const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtveXl2c3dwdHBuYnZuaGF4eHFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Nzk5ODEsImV4cCI6MjA5MzE1NTk4MX0.SfNZ3av-7uxpmqoo1c2jbHk0_qfA2liu4-ixShtmDf8';                          // ← ganti ini
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    /* ─ State Auth ─ */
    let currentUser     = null;
    let currentUsername = null;

    /* ═══════════════════════════════
       AUTH MODAL HELPERS
    ═══════════════════════════════ */
    let authMode = 'login'; // 'login' | 'register'

    function openAuthModal() {
      const overlay = document.getElementById('auth-modal-overlay');
      const modal   = document.getElementById('auth-modal');
      overlay.style.display = 'block';
      modal.style.display   = 'block';
      void overlay.offsetWidth;
      overlay.classList.add('visible');
      modal.classList.add('visible');
      document.body.style.overflow = 'hidden';
      clearAuthMessages();
    }
    function closeAuthModal() {
      const overlay = document.getElementById('auth-modal-overlay');
      const modal   = document.getElementById('auth-modal');
      overlay.classList.remove('visible');
      modal.classList.remove('visible');
      document.body.style.overflow = '';
      setTimeout(() => {
        overlay.style.display = 'none';
        modal.style.display   = 'none';
      }, 350);
    }
    function switchAuthTab(mode) {
      authMode = mode;
      document.getElementById('tab-login').classList.toggle('active',    mode === 'login');
      document.getElementById('tab-register').classList.toggle('active', mode === 'register');
      document.getElementById('auth-btn-text').textContent = mode === 'login' ? 'Masuk' : 'Daftar';
      document.getElementById('auth-switch-hint').innerHTML = mode === 'login'
        ? `Belum punya akun? <button onclick="switchAuthTab('register')">Daftar sekarang</button>`
        : `Sudah punya akun? <button onclick="switchAuthTab('login')">Masuk</button>`;
      clearAuthMessages();
    }
    function clearAuthMessages() {
      const err = document.getElementById('auth-error');
      const ok  = document.getElementById('auth-success');
      err.style.display = 'none';
      ok.style.display  = 'none';
    }
    function showAuthError(msg) {
      const el = document.getElementById('auth-error');
      el.textContent    = msg;
      el.style.display  = 'block';
      document.getElementById('auth-success').style.display = 'none';
    }
    function showAuthSuccess(msg) {
      const el = document.getElementById('auth-success');
      el.textContent   = msg;
      el.style.display = 'block';
      document.getElementById('auth-error').style.display = 'none';
    }
    function setAuthLoading(on) {
      document.getElementById('auth-btn-text').style.display    = on ? 'none' : 'inline';
      document.getElementById('auth-btn-spinner').style.display = on ? 'inline' : 'none';
      document.getElementById('auth-submit-btn').disabled       = on;
    }
    function togglePasswordVisibility() {
      const inp = document.getElementById('auth-password');
      inp.type  = inp.type === 'password' ? 'text' : 'password';
    }

    /* ── Username → fake email conversion ── */
    function usernameToEmail(username) {
      return username.trim().toLowerCase().replace(/\s+/g, '_') + '@sonicflow.com';
    }
    function validateUsername(username) {
      return /^[a-zA-Z0-9_]{3,30}$/.test(username.trim());
    }

    /* ─── Handle Register / Login submit ─── */
    async function handleAuthSubmit() {
      clearAuthMessages();
      const username = document.getElementById('auth-username').value.trim();
      const password = document.getElementById('auth-password').value;

      if (!username) { showAuthError('Username tidak boleh kosong.'); return; }
      if (!validateUsername(username)) {
        showAuthError('Username hanya boleh huruf, angka, dan underscore (3–30 karakter).');
        return;
      }
      if (password.length < 6) { showAuthError('Password minimal 6 karakter.'); return; }

      const email = usernameToEmail(username);
      setAuthLoading(true);

      if (authMode === 'register') {
        await handleRegister(username, email, password);
      } else {
        await handleLogin(email, password);
      }
      setAuthLoading(false);
    }

    async function handleRegister(username, email, password) {
      // Cek dulu apakah username sudah ada di tabel profiles
      const { data: existing } = await sb
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existing) {
        showAuthError('Username sudah terdaftar. Coba username lain.');
        return;
      }

      const { data, error } = await sb.auth.signUp({ email, password,
        options: { data: { username } }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          showAuthError('Username sudah terdaftar. Silakan masuk.');
        } else {
          showAuthError('Gagal daftar: ' + error.message);
        }
        return;
      }

      // Simpan profil username ke tabel profiles
      if (data.user) {
        await sb.from('profiles').upsert({
          id: data.user.id,
          username: username
        });
      }

      showAuthSuccess('Akun berhasil dibuat! Silakan masuk.');
      switchAuthTab('login');
    }

    async function handleLogin(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        showAuthError('Username atau password salah.');
        return;
      }
      currentUser = data.user;
      await loadUserProfile();
      onUserLoggedIn();
      closeAuthModal();
    }

    async function handleLogout() {
      await sb.auth.signOut();
      currentUser     = null;
      currentUsername = null;
      onUserLoggedOut();
    }

    async function loadUserProfile() {
      if (!currentUser) return;
      const { data } = await sb
        .from('profiles')
        .select('username')
        .eq('id', currentUser.id)
        .maybeSingle();
      currentUsername = data?.username || currentUser.user_metadata?.username || 'User';
    }

    /* ─── UI state saat login/logout ─── */
    function onUserLoggedIn() {
      // Update navbar button
      const btn   = document.getElementById('nav-auth-btn');
      btn.innerHTML = `<span id="nav-auth-icon">♪</span><span id="nav-auth-label">@${currentUsername}</span>`;
      btn.classList.add('logged-in');
      btn.onclick = handleLogout;

      // Show journal
      document.getElementById('journal-locked').style.display   = 'none';
      document.getElementById('journal-unlocked').style.display = 'block';
      document.getElementById('journal-username-display').textContent = '@' + currentUsername;

      // Load entries
      loadJournalEntries();
    }
    function onUserLoggedOut() {
      const btn = document.getElementById('nav-auth-btn');
      btn.innerHTML = `<span id="nav-auth-icon">♩</span><span id="nav-auth-label">Login</span>`;
      btn.classList.remove('logged-in');
      btn.onclick = openAuthModal;

      document.getElementById('journal-locked').style.display   = 'flex';
      document.getElementById('journal-unlocked').style.display = 'none';
      document.getElementById('journal-entries-list').innerHTML =
        '<div id="journal-entries-empty"><span>♩</span><p>Belum ada entri. Mulai tulis jurnalmu!</p></div>';
    }

    /* ─── Restore session on page load ─── */
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        currentUser = session.user;
        await loadUserProfile();
        onUserLoggedIn();
      }
    });

    /* ─── Listen to auth state changes ─── */
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        currentUser = session.user;
        if (!currentUsername) {
          await loadUserProfile();
          onUserLoggedIn();
        }
      } else if (event === 'SIGNED_OUT') {
        currentUser     = null;
        currentUsername = null;
        onUserLoggedOut();
      }
    });

    /* ═══════════════════════════════
       SOUL JOURNAL — Save & Load
    ═══════════════════════════════ */
    let selectedJournalMood = null;

    function selectJournalMood(el) {
      document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      selectedJournalMood = el.dataset.mood;
    }

    // Set tanggal hari ini di composer header
    function updateJournalDate() {
      const el = document.getElementById('journal-date-display');
      if (!el) return;
      const now = new Date();
      el.textContent = now.toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }
    updateJournalDate();

    // Char counter
    const journalInput = document.getElementById('journal-input');
    if (journalInput) {
      journalInput.addEventListener('input', function() {
        document.getElementById('journal-char-count').textContent =
          this.value.length + ' / 2000';
      });
    }

    async function saveJournal() {
      if (!currentUser) { openAuthModal(); return; }
      const text = document.getElementById('journal-input').value.trim();
      if (!text) return;

      document.getElementById('journal-save-text').style.display    = 'none';
      document.getElementById('journal-save-spinner').style.display = 'inline';
      document.getElementById('journal-save-btn').disabled          = true;

      const { error } = await sb.from('journals').insert({
        user_id:  currentUser.id,
        username: currentUsername,
        content:  text,
        mood:     selectedJournalMood || null,
        created_at: new Date().toISOString()
      });

      document.getElementById('journal-save-text').style.display    = 'inline';
      document.getElementById('journal-save-spinner').style.display = 'none';
      document.getElementById('journal-save-btn').disabled          = false;

      if (!error) {
        document.getElementById('journal-input').value = '';
        document.getElementById('journal-char-count').textContent = '0 / 2000';
        document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('selected'));
        selectedJournalMood = null;
        loadJournalEntries();

        // Mini konfirmasi animasi pada tombol
        const btn = document.getElementById('journal-save-btn');
        btn.style.background = '#4CAF50';
        btn.querySelector('#journal-save-text').textContent = '✓ Tersimpan!';
        setTimeout(() => {
          btn.style.background = '';
          btn.querySelector('#journal-save-text').textContent = 'Simpan';
        }, 1800);
      }
    }

    async function loadJournalEntries() {
      if (!currentUser) return;
      const { data, error } = await sb
        .from('journals')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(30);

      const list = document.getElementById('journal-entries-list');
      if (error || !data || data.length === 0) {
        list.innerHTML = '<div id="journal-entries-empty"><span>♩</span><p>Belum ada entri. Mulai tulis jurnalmu!</p></div>';
        return;
      }
      list.innerHTML = '';
      data.forEach(entry => {
        const el   = document.createElement('div');
        el.className = 'journal-entry';
        el.dataset.id = entry.id;

        const date = new Date(entry.created_at).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        const moodMap = { happy:'😊 Senang', sad:'😢 Sedih', excited:'⚡ Excited', calm:'🌿 Tenang', angry:'🔥 Marah' };
        const moodBadge = entry.mood
          ? `<span class="journal-entry-mood-badge">${moodMap[entry.mood] || entry.mood}</span>`
          : '';
        const isLong = entry.content.length > 200;
        const textId = 'jtxt-' + entry.id;

        el.innerHTML = `
          <div class="journal-entry-header">
            <div class="journal-entry-meta">
              ${moodBadge}
              <span class="journal-entry-date">${date}</span>
            </div>
            <button class="journal-entry-del" onclick="deleteJournalEntry('${entry.id}', this)" title="Hapus">✕</button>
          </div>
          <div class="journal-entry-text ${isLong ? 'clamped' : ''}" id="${textId}">${escapeHtml(entry.content)}</div>
          ${isLong ? `<button class="journal-entry-expand" onclick="toggleEntryExpand('${textId}', this)">Baca selengkapnya ↓</button>` : ''}
        `;
        list.appendChild(el);
      });
    }

    function toggleEntryExpand(textId, btn) {
      const el = document.getElementById(textId);
      if (el.classList.contains('clamped')) {
        el.classList.remove('clamped');
        btn.textContent = 'Sembunyikan ↑';
      } else {
        el.classList.add('clamped');
        btn.textContent = 'Baca selengkapnya ↓';
      }
    }

    async function deleteJournalEntry(id, btn) {
      if (!confirm('Hapus entri ini?')) return;
      const { error } = await sb.from('journals').delete().eq('id', id);
      if (!error) {
        const card = btn.closest('.journal-entry');
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity    = '0';
        card.style.transform  = 'translateX(20px)';
        setTimeout(() => { card.remove(); checkEntriesEmpty(); }, 320);
      }
    }

    function checkEntriesEmpty() {
      const list = document.getElementById('journal-entries-list');
      if (!list.querySelector('.journal-entry')) {
        list.innerHTML = '<div id="journal-entries-empty"><span>♩</span><p>Belum ada entri. Mulai tulis jurnalmu!</p></div>';
      }
    }

    function escapeHtml(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    /* Keyboard shortcut: tutup modal dengan Escape */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAuthModal();
    });

    /* ════════════════════════════════
       CUSTOM CURSOR
    ════════════════════════════════ */
    const cursor = document.getElementById('cursor');
    const cursorRing = document.getElementById('cursor-ring');
    let cx = 0, cy = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', e => { cx = e.clientX; cy = e.clientY; });

    (function animateCursor() {
      rx += (cx - rx) * 0.18;
      ry += (cy - ry) * 0.18;
      cursor.style.left = cx + 'px';
      cursor.style.top  = cy + 'px';
      cursorRing.style.left = rx + 'px';
      cursorRing.style.top  = ry + 'px';
      requestAnimationFrame(animateCursor);
    })();

    document.querySelectorAll('a, button, .mood-card, .squad-card, .ans-btn').forEach(el => {
      el.addEventListener('mouseenter', () => { cursor.style.transform = 'translate(-50%,-50%) scale(2.2)'; });
      el.addEventListener('mouseleave', () => { cursor.style.transform = 'translate(-50%,-50%) scale(1)'; });
    });

    /* ════════════════════════════════
       TOUCH DETECTION — Nonaktifkan cursor di HP/Tablet
    ════════════════════════════════ */
    function isTouchDevice() {
      return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    }
    if (isTouchDevice()) {
      document.getElementById('cursor').style.display      = 'none';
      document.getElementById('cursor-ring').style.display = 'none';
      document.body.style.cursor = 'auto';
      document.querySelectorAll(
        '.mood-card,.btn-outline,.ans-btn,.squad-card,nav ul a,.info-col a,' +
        '.practice-tab,#mic-toggle-btn,#rec-btn,#play-btn'
      ).forEach(el => { el.style.cursor = 'pointer'; });
      document.querySelectorAll('a,button').forEach(el => { el.style.cursor = 'pointer'; });
    }

    /* ════════════════════════════════
       HAMBURGER MENU
    ════════════════════════════════ */
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const navOverlay   = document.getElementById('nav-overlay');
    const drawerClose  = document.getElementById('drawer-close');

    function openDrawer() {
      mobileDrawer.classList.add('open');
      navOverlay.style.display = 'block';
      void navOverlay.offsetWidth;
      navOverlay.classList.add('visible');
      hamburgerBtn.classList.add('open');
      hamburgerBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
      mobileDrawer.classList.remove('open');
      navOverlay.classList.remove('visible');
      hamburgerBtn.classList.remove('open');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      setTimeout(() => { navOverlay.style.display = 'none'; }, 350);
    }
    hamburgerBtn.addEventListener('click', () => {
      mobileDrawer.classList.contains('open') ? closeDrawer() : openDrawer();
    });
    drawerClose.addEventListener('click', closeDrawer);
    navOverlay.addEventListener('click', closeDrawer);
    window.addEventListener('resize', () => { if (window.innerWidth > 860) closeDrawer(); });


    const canvas = document.getElementById('rain-canvas');
    const ctx = canvas.getContext('2d');
    let drops = [];

    function initCanvas() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      drops = [];
      for (let i = 0; i < 90; i++) {
        drops.push({
          x:       Math.random() * canvas.width,
          y:       Math.random() * canvas.height,
          len:     Math.random() * 70 + 20,
          speed:   Math.random() * 0.9 + 0.25,
          opacity: Math.random() * 0.2 + 0.04,
          width:   Math.random() * 0.8 + 0.3
        });
      }
    }

    function animateRain() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drops.forEach(d => {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * 0.1, d.y + d.len);
        ctx.strokeStyle = `rgba(201,168,76,${d.opacity})`;
        ctx.lineWidth = d.width;
        ctx.stroke();
        d.y += d.speed;
        if (d.y > canvas.height + d.len) {
          d.y = -d.len;
          d.x = Math.random() * canvas.width;
        }
      });
      requestAnimationFrame(animateRain);
    }

    initCanvas();
    animateRain();
    window.addEventListener('resize', initCanvas);

    /* ════════════════════════════════
       BLOB + WAVE FOLLOW CURSOR
    ════════════════════════════════ */
    const blobSvg = document.getElementById('blob-svg');
    const homeSection = document.getElementById('home');
    let blobX = 400, blobY = 300, mbX = 400, mbY = 300;

    homeSection.addEventListener('mousemove', e => {
      const r = homeSection.getBoundingClientRect();
      mbX = e.clientX - r.left - 170;
      mbY = e.clientY - r.top  - 170;
    });

    (function animateBlob() {
      blobX += (mbX - blobX) * 0.07;
      blobY += (mbY - blobY) * 0.07;
      blobSvg.style.left = blobX + 'px';
      blobSvg.style.top  = blobY + 'px';

      const t = Date.now() / 1300;
      const a = Math.sin(t) * 18;
      const b = Math.cos(t * 0.7) * 12;

      document.getElementById('wv1').setAttribute('d',
        `M 30 ${170+a} Q 80 ${130-a} 130 ${170+a} Q 180 ${210+a} 230 ${170-a} Q 270 ${130+a} 310 ${170+a}`);
      document.getElementById('wv2').setAttribute('d',
        `M 20 ${190-b} Q 75 ${145+b} 130 ${190-b} Q 185 ${230-b} 240 ${190+b} Q 285 ${148-b} 320 ${190-b}`);
      document.getElementById('wv3').setAttribute('d',
        `M 30 ${152+b} Q 85 ${112-b} 135 ${152+b} Q 185 ${190+b} 235 ${152-b} Q 280 ${112+b} 315 ${152+b}`);

      requestAnimationFrame(animateBlob);
    })();

    /* ════════════════════════════════
       MUSIK / SPOTIFY MOOD
       ─────────────────────────────
       DEVELOPER: Isi playlist ID kamu di objek playlists di bawah.
       Format ID: bagian akhir URL Spotify, contoh:
       https://open.spotify.com/playlist/37i9dQZF1DX3YSRoSdA634
                                          ↑ ini ID-nya
    ════════════════════════════════ */
    const playlists = {
      sad:   '7gInDmUbitTujZnfkZP5cL',    // ← Tempel Spotify Playlist ID untuk mood Sad
      happy: '1F4Blteq0gK70zV7YMcVic',  // ← Tempel Spotify Playlist ID untuk mood Happy
      angry: '13JLEbC6DSWdjOaWAWYA9u',  // ← Tempel Spotify Playlist ID untuk mood Angry
      bored: '79CVfGtYLBRongKkFxB6o3'   // ← Tempel Spotify Playlist ID untuk mood Bored
    };

    function selectMood(card, mood) {
      document.querySelectorAll('.mood-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const ph    = document.getElementById('spotify-ph');
      const embed = document.getElementById('spotify-embed');
      const id    = playlists[mood];

      if (id && !id.startsWith('YOUR_')) {
        ph.style.display    = 'none';
        embed.style.display = 'block';
        embed.innerHTML = `<iframe
          src="https://open.spotify.com/embed/playlist/${id}?utm_source=generator&theme=0"
          width="100%" height="352" frameBorder="0" allowfullscreen
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"></iframe>`;
      } else {
        ph.style.display    = 'block';
        embed.style.display = 'none';
        ph.innerHTML = `🎵 Playlist untuk mood <strong>${mood.toUpperCase()}</strong> belum diisi.<br>
          <small style="opacity:0.65;">Tambahkan Spotify Playlist ID di variabel <code>playlists.${mood}</code> dalam script.</small>`;
      }
    }

    /* ════════════════════════════════
       MINI GAME — DEVELOPER DATA EDITION
       ─────────────────────────────────
       DEVELOPER: Isi data lagu di array `songs` di bawah.
       Format tiap objek:
       {
         title:   "Judul Lagu",
         artist:  "Nama Artis",
         src:     "audio/nama-file.mp3",
         options: ["Pilihan A","Pilihan B","Pilihan C","Pilihan D"]
       }
       Urutan options bebas — sistem akan otomatis tahu mana yang benar.
    ════════════════════════════════ */
    const songs = [
      {
        title:   "Starboy",
        artist:  "The Weeknd, Daft Punk",
        src:     "lagu/starboy.mp3",
        options: ["Blinding Lights", "Save Your Tears", "Starboy", "In Your Eyes"]
      },
      {
        title:   "Risk It All",
        artist:  "Bruno Mars",
        src:     "lagu/riskitall.mp3",
        options: ["Perfect", "Risk It All", "Shape of You", "Thinking Out Loud"]
      },
      {
        title:   "Minggu depan atau sekarang",
        artist:  "Sandra Lucia de Souza",
        src:     "lagu/mingdep.mp3",
        options: ["Physical", "Levitating", "Don't Start Now", "Minggu depan atau sekarang"]
      },
      {
        title:   "Menteri durmagati",
        artist:  "KAJAWI",
        src:     "lagu/mendur.mp3",
        options: ["Rakyat Pres", "Menteri durmagati", "Maju Maju", "Stay Dumag"]
      },
      {
        title:   "Buried Alive",
        artist:  "A7X",
        src:     "lagu/buriedalive.mp3",
        options: ["21 Guns", "Gunslinger", "Disenchanted", "Buried Alive"]
      },
      {
        title:   "Fix you",
        artist:  "Coldplay",
        src:     "lagu/fixyou.mp3",
        options: ["Fix you", "Adore You", "Watermelon Sugar", "Sign of the Times"]
      },
      {
        title:   "Feed from desire",
        artist:  "Gala, Molella, Phil Jay",
        src:     "lagu/feedfd.mp3",
        options: ["deja vu", "drivers license", "good 4 u", "Feed from desire"]
      },
      {
        title:   "Akhir tak bahagia",
        artist:  "Misellia",
        src:     "lagu/akhirgbaha.mp3",
        options: ["Akhir tak bahagia", "Menerima luka", "Hargai aku", "Sekuat hatimu"]
      },
      {
        title:   "beauty and a beat",
        artist:  "Justin Bieber, Nicki Minaj",
        src:     "lagu/beautybet.mp3",
        options: ["Easy On Me", "Hello my girl", "Rolling in the Deep", "beauty and a beat"]
      },
      {
        title:   "King Manchester United",
        artist:  "oLil Nas X",
        src:     "lagu/mu.mp3",
        options: ["Industry Baby", "Sun Goes Down", "That's What I Want", "King Manchester United"]
      },
      {
        title:   "Raiso ngapusi",
        artist:  "La tasya, Aryan saputra",
        src:     "lagu/raisongaps.mp3",
        options: ["Raiso ngapusi", "Saktenane", "Rasah bali", "Akhire lungo"]
      },
      {
        title:   "Merindukanmu",
        artist:  "D'MASIV",
        src:     "lagu/merindukan.mp3",
        options: ["Awas jatuh cinta", "Merindukanmu", "Sampai kau jadi milikku", "Tentang kamu"]
      },
      {
        title:   "Gadis manis kalimantan",
        artist:  "Ajeng febria, Brodin",
        src:     "lagu/gadiskal.mp3",
        options: ["Gadis manis kalimantan", "Salahmu sendiri", "Kasmaran", "Jangan tunggu lama lama"]
      },
      {
        title:   "Abadi",
        artist:  "Ajeng febria, Brodin",
        src:     "lagu/abadi.mp3",
        options: ["Abadi", "Salahmu sendiri", "cinta sendirian", "Jatuh cinta"]
      }
    ];

    // ─── Build correct index from options array ───
    songs.forEach(s => { s.correct = s.options.indexOf(s.title); });

    // ─── Audio Visualizer Setup ───
    const vizCanvas = document.getElementById('viz-canvas');
    const vizCtx    = vizCanvas.getContext('2d');
    const vizIdle   = document.getElementById('viz-idle');
    let audioCtx    = null;
    let analyser    = null;
    let vizSource   = null;
    let vizRunning  = false;

    function initVisualizer(audioEl) {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;
        analyser.connect(audioCtx.destination);
      }
      if (vizSource) { try { vizSource.disconnect(); } catch(e) {} }
      vizSource = audioCtx.createMediaElementSource(audioEl);
      vizSource.connect(analyser);
      if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function resizeVizCanvas() {
      vizCanvas.width  = vizCanvas.offsetWidth  * window.devicePixelRatio;
      vizCanvas.height = vizCanvas.offsetHeight * window.devicePixelRatio;
      vizCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    resizeVizCanvas();
    window.addEventListener('resize', resizeVizCanvas);

    function drawVisualizer() {
      if (!vizRunning || !analyser) return;
      requestAnimationFrame(drawVisualizer);
      const W = vizCanvas.offsetWidth;
      const H = vizCanvas.offsetHeight;
      const bufLen = analyser.frequencyBinCount;
      const data   = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(data);
      vizCtx.clearRect(0, 0, W, H);
      const barCount = 48;
      const gap      = 3;
      const barW     = (W - gap * (barCount - 1)) / barCount;
      for (let i = 0; i < barCount; i++) {
        const idx  = Math.floor(i / barCount * bufLen);
        const val  = data[idx] / 255;
        const barH = Math.max(3, val * H * 0.92);
        const x    = i * (barW + gap);
        const y    = (H - barH) / 2;
        const r    = Math.round(201 - val * 140);
        const g    = Math.round(168 - val * 76);
        const b    = Math.round(76  + val * 20);
        vizCtx.fillStyle = `rgba(${r},${g},${b},${0.55 + val * 0.45})`;
        const radius = Math.min(barW / 2, 3);
        vizCtx.beginPath();
        vizCtx.roundRect(x, y, barW, barH, radius);
        vizCtx.fill();
      }
    }

    function startVisualizer() {
      vizIdle.style.display = 'none';
      vizRunning = true;
      drawVisualizer();
    }

    function stopVisualizer() {
      vizRunning = false;
      vizCtx.clearRect(0, 0, vizCanvas.offsetWidth, vizCanvas.offsetHeight);
      vizIdle.style.display = 'flex';
    }

    // ─── Game State ───
    const game = { round: 0, score: 0, streak: 0, playing: false, timer: null, currentAudio: null };

    /* ════════════════════════════════
       HIGH SCORE — localStorage
    ════════════════════════════════ */
    const HS_KEY = 'sonicflow_highscore';
    function getHighScore()       { return parseInt(localStorage.getItem(HS_KEY) || '0'); }
    function saveHighScore(score) { localStorage.setItem(HS_KEY, score); }
    function updateHighScoreDisplay() {
      const el = document.getElementById('sc-highscore');
      if (el) el.textContent = getHighScore();
    }
    updateHighScoreDisplay();
    const hsBanner = document.createElement('div');
    hsBanner.id = 'new-highscore-banner';
    hsBanner.textContent = '★ New Best!';
    document.body.appendChild(hsBanner);

    document.getElementById('sc-total').textContent = songs.length;

    function renderRound() {
      const s = songs[game.round % songs.length];
      document.getElementById('sc-round').textContent  = (game.round % songs.length) + 1;
      document.getElementById('sc-score').textContent  = game.score;
      document.getElementById('sc-streak').textContent = game.streak;

      const ans = document.getElementById('answers');
      ans.innerHTML = '';
      s.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className   = 'ans-btn';
        btn.textContent = opt;
        btn.onclick     = () => checkAnswer(i, btn, s);
        ans.appendChild(btn);
      });
    }

    function togglePlay() {
      const btn = document.getElementById('play-btn');
      const s   = songs[game.round % songs.length];

      if (game.playing) {
        if (game.currentAudio) game.currentAudio.pause();
        game.playing = false;
        btn.textContent = '▶';
        stopVisualizer();
        document.getElementById('song-title').textContent  = 'Dijeda — tekan ▶ lanjut';
        document.getElementById('song-artist').textContent = '—';
        return;
      }

      // Stop previous audio
      if (game.currentAudio) { game.currentAudio.pause(); game.currentAudio.currentTime = 0; }

      const audio = new Audio(s.src);
      audio.crossOrigin = 'anonymous';
      game.currentAudio = audio;
      try { initVisualizer(audio); } catch(e) {}
      audio.play().then(() => {
        startVisualizer();
      }).catch(() => {
        document.getElementById('song-title').textContent  = '♫ [File audio belum diisi developer]';
        document.getElementById('song-artist').textContent = 'Tebak judulnya tetap bisa!';
      });

      game.playing = true;
      btn.textContent = '⏸';
      document.getElementById('song-title').textContent  = '♫ Dengarkan baik-baik...';
      document.getElementById('song-artist').textContent = 'Tebak judul lagunya!';

      const fill   = document.getElementById('progress-fill');
      const timeEl = document.getElementById('progress-time');

      const fmt = t => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;

      function updateProgress() {
        if (!game.playing || !audio || audio.paused) return;
        const cur = audio.currentTime;
        const dur = audio.duration || 0;
        fill.style.width = dur ? (cur / dur * 100) + '%' : '0%';
        timeEl.textContent = dur ? `${fmt(cur)} / ${fmt(dur)}` : '—';
        requestAnimationFrame(updateProgress);
      }
      audio.addEventListener('loadedmetadata', updateProgress);
      updateProgress();

      audio.addEventListener('ended', () => {
        game.playing = false;
        btn.textContent = '▶';
        stopVisualizer();
        document.getElementById('song-title').textContent  = 'Audio selesai — pilih jawaban!';
        document.getElementById('song-artist').textContent = '—';
      });
    }

    function checkAnswer(i, btn, song) {
      document.querySelectorAll('.ans-btn').forEach(b => b.disabled = true);
      if (game.currentAudio) { game.currentAudio.pause(); game.currentAudio.currentTime = 0; }
      game.playing = false;
      stopVisualizer();
      document.getElementById('play-btn').textContent = '▶';

      const ok = i === song.correct;
      btn.classList.add(ok ? 'correct' : 'wrong');
      if (!ok) document.querySelectorAll('.ans-btn')[song.correct].classList.add('reveal');

      if (ok) {
        game.score  += 10 + game.streak * 2;
        game.streak += 1;
        showFeedback('✓', '#4CAF50');
        triggerScorePulse();
        spawnParticles();
      } else {
        game.streak = 0;
        showFeedback('✗', '#f55');
      }

      document.getElementById('song-artist').textContent = song.artist;
      document.getElementById('sc-score').textContent    = game.score;
      document.getElementById('sc-streak').textContent   = game.streak;

      const isLast = (game.round + 1) >= songs.length;
      if (game.score > getHighScore()) {
        saveHighScore(game.score);
        updateHighScoreDisplay();
        showNewHighScoreBanner();
      }

      setTimeout(() => {
        if (isLast) {
          document.getElementById('song-title').textContent  = `🏆 Game selesai! Score: ${game.score}`;
          document.getElementById('song-artist').textContent = 'Refresh halaman untuk main lagi';
        } else {
          game.round++;
          document.getElementById('progress-fill').style.width = '0%';
          document.getElementById('progress-time').textContent  = '0:00 / 0:00';
          document.getElementById('song-title').textContent     = 'Tekan ▶ untuk ronde berikutnya';
          document.getElementById('song-artist').textContent    = '—';
          renderRound();
        }
      }, 1800);
    }

    function showFeedback(sym, color) {
      const pop = document.getElementById('feedback-pop');
      pop.textContent = sym;
      pop.style.color = color;
      pop.style.transform = 'translate(-50%,-50%) scale(1)';
      pop.style.opacity   = '1';
      setTimeout(() => {
        pop.style.transform = 'translate(-50%,-50%) scale(0)';
        pop.style.opacity   = '0';
      }, 800);
    }

    function triggerScorePulse() {
      const el = document.getElementById('sc-score');
      if (!el) return;
      el.classList.remove('score-pulse');
      void el.offsetWidth;
      el.classList.add('score-pulse');
      el.addEventListener('animationend', () => el.classList.remove('score-pulse'), { once: true });
    }

    function spawnParticles() {
      const container = document.getElementById('particle-burst');
      if (!container) return;
      const ox = window.innerWidth / 2, oy = window.innerHeight / 2;
      const colors = ['#C9A84C','#E8C87A','#ffffff','#4CAF50','#80d883'];
      for (let i = 0; i < 22; i++) {
        const p     = document.createElement('div');
        p.className = 'particle';
        const angle = Math.random() * Math.PI * 2;
        const dist  = 80 + Math.random() * 180;
        const tx    = Math.cos(angle) * dist;
        const ty    = Math.sin(angle) * dist;
        const dur   = (0.6 + Math.random() * 0.5).toFixed(2) + 's';
        const delay = (Math.random() * 0.15).toFixed(2) + 's';
        const size  = (4 + Math.random() * 6).toFixed(1) + 'px';
        const color = colors[Math.floor(Math.random() * colors.length)];
        p.style.cssText = `left:${ox}px;top:${oy}px;--tx:${tx}px;--ty:${ty}px;--dur:${dur};animation-delay:${delay};background:${color};width:${size};height:${size};box-shadow:0 0 6px ${color};`;
        container.appendChild(p);
        setTimeout(() => p.remove(), 1200);
      }
    }

    function showNewHighScoreBanner() {
      const banner = document.getElementById('new-highscore-banner');
      if (!banner) return;
      banner.classList.add('show');
      setTimeout(() => banner.classList.remove('show'), 2200);
    }

    renderRound();

    /* ════════════════════════════════
       SQUAD GALLERY
       ─────────────────────────────
       DEVELOPER: Ubah data anggota tim di array squadData.
       Untuk foto nyata: ganti properti `emoji` dengan `img: 'path/ke/foto.jpg'`
    ════════════════════════════════ */
    const squadData = [
      { name: "M. Renno Agustovano", role: "Lead Developer",    motto: "Code is poetry in motion",       img: "picture/reno.jpeg", emoji: "🎵" },
      { name: "Marisa Al Zahra", role: "Programmer",    motto: "Batu besar yang menghalangi jalanmu bisa jadi batu pijakan kalau kamu mau melihatnya dari sudut berbeda", img: "picture/marisa.jpeg", emoji: "🎸" },
      { name: "Damara Keisya R.", role: "Programmer",  motto: "Focus on your goal, dont look in any direction but ahead",       img: "picture/damara.jpeg", emoji: "🎹" },
      { name: "Ajeng Candra Lokasari", role: "Programmer",      motto: "Kegagalan adalah bumbu yang memberi rasa pada kesuksesan",     img: "picture/ajeng.jpeg", emoji: "🎷" },
      { name: "Hendro Nur Saputra", role: "Programmer",    motto: "Hendro tanpa kata-kata bagaikan Singa tanpa mahkota",      img: "picture/hendro.jpeg", emoji: "🥁" },
      { name: "Anindya Livya Azzahra", role: "Programmer",     motto: "Niatnya berubah, actionya masih buffering realita",        img: "picture/livy.jpeg", emoji: "🎺" },
      { name: "Aydin Akmal Daffa", role: "Programmer",   motto: "Jangan biarkan hari buruk membuatmu merasa punya kehidupan yang buruk.",            img: "picture/aydin.jpeg", emoji: "🎻" },
      { name: "Gendis Kirana Larasati", role: "Programmer",   motto: "Sukses adalah jumlah dari usaha-usaha kecil yang diulang hari demi hari",         img: "picture/gendis.jpeg", emoji: "🎤" }
    ];

    const grid = document.getElementById('squad-grid');
    squadData.forEach(m => {
      const card = document.createElement('div');
      card.className = 'squad-card';
      const photoContent = m.img
        ? `<img src="${m.img}" alt="Foto ${m.name}" loading="lazy">`
        : m.emoji;
      card.innerHTML = `
        <div class="squad-ph">${photoContent}</div>
        <div class="squad-overlay">
          <div class="sq-name">${m.name}</div>
          <div class="sq-role">${m.role}</div>
          <div class="sq-motto">"${m.motto}"</div>
        </div>`;
      grid.appendChild(card);
    });

    /* ════════════════════════════════
       PRACTICE MODE
    ════════════════════════════════ */

    // ── Tab Switcher ──
    function switchPracticeTab(tab, el) {
      document.querySelectorAll('.practice-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      document.getElementById(tab + '-panel').classList.add('active');
    }

    /* ─────────────────────────────────
       1. MICROPHONE VISUALIZER
    ───────────────────────────────── */
    let micStream     = null;
    let micAudioCtx   = null;
    let micAnalyser   = null;
    let micSource     = null;
    let micRunning    = false;
    let micAnimId     = null;

    const micCanvas   = document.getElementById('mic-canvas');
    const micCtx      = micCanvas.getContext('2d');
    const micVizWrap  = document.getElementById('mic-viz-wrap');
    const micIdleMsg  = document.getElementById('mic-idle-msg');
    const micDbFill   = document.getElementById('mic-db-fill');
    const micDbVal    = document.getElementById('mic-db-val');
    const micStatus   = document.getElementById('mic-status');
    const micToggleBtn= document.getElementById('mic-toggle-btn');
    const micBtnText  = document.getElementById('mic-btn-text');

    function resizeMicCanvas() {
      micCanvas.width  = micCanvas.offsetWidth  * (window.devicePixelRatio || 1);
      micCanvas.height = micCanvas.offsetHeight * (window.devicePixelRatio || 1);
    }
    resizeMicCanvas();
    window.addEventListener('resize', resizeMicCanvas);

    async function toggleMic() {
      if (micRunning) {
        stopMic();
      } else {
        await startMic();
      }
    }

    async function startMic() {
      try {
        micStatus.textContent = 'Meminta izin mikrofon...';
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        micAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        micAnalyser = micAudioCtx.createAnalyser();
        micAnalyser.fftSize = 256;
        micAnalyser.smoothingTimeConstant = 0.75;
        micSource = micAudioCtx.createMediaStreamSource(micStream);
        micSource.connect(micAnalyser);

        micRunning = true;
        micIdleMsg.style.display = 'none';
        micVizWrap.classList.add('active-mic');
        micToggleBtn.classList.add('listening');
        micBtnText.textContent = 'Matikan Mikrofon';
        micStatus.textContent  = 'Mikrofon aktif — nyanyilah!';

        drawMicVisualizer();
      } catch(e) {
        micStatus.textContent = 'Izin mikrofon ditolak atau tidak tersedia.';
      }
    }

    function stopMic() {
      micRunning = false;
      if (micAnimId) cancelAnimationFrame(micAnimId);
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (micAudioCtx) micAudioCtx.close();
      micStream = null; micAudioCtx = null; micAnalyser = null; micSource = null;

      micCtx.clearRect(0, 0, micCanvas.width, micCanvas.height);
      micVizWrap.classList.remove('active-mic');
      micToggleBtn.classList.remove('listening');
      micIdleMsg.style.display = 'flex';
      micBtnText.textContent = 'Aktifkan Mikrofon';
      micStatus.textContent  = 'Mikrofon dimatikan';
      micDbFill.style.width  = '0%';
      micDbVal.textContent   = '— dB';
    }

    function drawMicVisualizer() {
      if (!micRunning || !micAnalyser) return;
      micAnimId = requestAnimationFrame(drawMicVisualizer);

      const W = micCanvas.offsetWidth;
      const H = micCanvas.offsetHeight;
      const bufLen = micAnalyser.frequencyBinCount;
      const data   = new Uint8Array(bufLen);
      micAnalyser.getByteFrequencyData(data);

      micCtx.clearRect(0, 0, micCanvas.width, micCanvas.height);

      // Waveform bars — circular burst style
      const barCount = 64;
      const barW = (W - 2 * (barCount - 1)) / barCount;

      // Compute RMS for dB meter
      let sumSq = 0;
      data.forEach(v => sumSq += (v / 255) * (v / 255));
      const rms = Math.sqrt(sumSq / bufLen);
      const db  = rms > 0 ? Math.round(20 * Math.log10(rms)) : -Infinity;
      const dbPct = Math.min(100, Math.max(0, (db + 60) / 60 * 100));
      micDbFill.style.width = dbPct + '%';
      micDbVal.textContent  = isFinite(db) ? db + ' dB' : '— dB';

      for (let i = 0; i < barCount; i++) {
        const idx  = Math.floor(i / barCount * bufLen);
        const val  = data[idx] / 255;
        const barH = Math.max(3, val * H * 0.9);
        const x    = i * (barW + 2);
        const y    = (H - barH) / 2;

        // Color shift: green → gold → red based on level
        const r = Math.round(26  + val * 230);
        const g = Math.round(92  + val * 20);
        const b = Math.round(54  - val * 40);
        micCtx.fillStyle = `rgba(${r},${g},${b},${0.6 + val * 0.4})`;

        const radius = Math.min(barW / 2, 3);
        micCtx.beginPath();
        micCtx.roundRect(x, y, barW, barH, radius);
        micCtx.fill();

        // Reflection
        micCtx.fillStyle = `rgba(${r},${g},${b},${0.1 + val * 0.1})`;
        micCtx.beginPath();
        micCtx.roundRect(x, H / 2 + barH / 2 + 2, barW, barH * 0.3, radius);
        micCtx.fill();
      }
    }

    /* ─────────────────────────────────
       2. LYRIC DISPLAY
    ───────────────────────────────── */

    // Sample lyrics keyed by song title (timed in seconds)
    const lyricData = {
      "Blinding Lights": [
        { t: 0,   line: "♪ Intro — bersiaplah...",                   next: "" },
        { t: 4,   line: "I been tryna call",                          next: "I been on my own for long enough" },
        { t: 7,   line: "I been on my own for long enough",           next: "Maybe you can show me how to love, maybe" },
        { t: 11,  line: "Maybe you can show me how to love, maybe",   next: "I'm going through withdrawals" },
        { t: 15,  line: "I'm going through withdrawals",              next: "" },
        { t: 19,  line: "You don't even have to do too much",         next: "You can turn me on with just a touch, baby" },
        { t: 23,  line: "You can turn me on with just a touch, baby", next: "I look around and sin is all I see" },
        { t: 27,  line: "I'm blinded by the lights",                  next: "No, I can't sleep until I feel your touch" },
        { t: 31,  line: "No, I can't sleep until I feel your touch",  next: "" },
      ],
      "Shape of You": [
        { t: 0,  line: "♪ Intro...",                                  next: "" },
        { t: 4,  line: "The club isn't the best place to find a lover", next: "So the bar is where I go" },
        { t: 8,  line: "So the bar is where I go",                    next: "Me and my friends at the table doing shots" },
        { t: 12, line: "Me and my friends at the table doing shots",  next: "Drinking fast and then we talk slow" },
        { t: 16, line: "And you come over and start up a conversation with just me", next: "" },
        { t: 20, line: "And trust me I'll give it a chance now",      next: "Take my hand, stop, put Van the Man on the jukebox" },
        { t: 24, line: "I'm in love with the shape of you",           next: "We push and pull like a magnet do" },
        { t: 28, line: "We push and pull like a magnet do",           next: "Although my heart is falling too" },
        { t: 32, line: "I'm in love with your body",                  next: "" },
      ],
      "Levitating": [
        { t: 0,  line: "♪ Intro...",                                  next: "" },
        { t: 5,  line: "If you wanna run away with me, I know a galaxy", next: "And I can take you for a ride" },
        { t: 10, line: "I had a premonition that we fell into a rhythm", next: "Where the music don't stop for life" },
        { t: 15, line: "Glitter in the sky, glitter in my eyes",      next: "Shining just the way I like" },
        { t: 19, line: "If you're feeling like you need a little guidance", next: "Let me be your pilot" },
        { t: 23, line: "I believe that you are my universe",          next: "" },
        { t: 27, line: "I'm levitating",                              next: "The Milky Way, we're renegading" },
        { t: 31, line: "You can't stop my shining",                   next: "" },
      ],
      "Stay": [
        { t: 0,  line: "♪ Intro...",                                  next: "" },
        { t: 4,  line: "Waiting for the time to pass you by",         next: "Hope the winds of change will change your mind" },
        { t: 9,  line: "I could give a thousand reasons why",         next: "Don't you open up that window" },
        { t: 13, line: "Don't you let the rain come in",              next: "Stay with me a little longer" },
        { t: 17, line: "I do believe that you could change your mind", next: "" },
        { t: 21, line: "Stay, I want you to stay",                    next: "Stay, I want you to stay" },
        { t: 25, line: "Run away, but we're running in circles",      next: "" },
        { t: 29, line: "We're running in circles",                    next: "" },
      ],
      "Bad Guy": [
        { t: 0,  line: "♪ Intro...",                                  next: "" },
        { t: 4,  line: "White shirt now red, my bloody nose",         next: "Sleeping, you're on your tippy toes" },
        { t: 8,  line: "Creeping around like no one knows",           next: "Think you're so criminal" },
        { t: 12, line: "Think you're so criminal",                    next: "" },
        { t: 16, line: "Bruises on both my knees for you",            next: "Don't say thank you or please" },
        { t: 20, line: "Don't say thank you or please",               next: "I do what I want when I'm wanting to" },
        { t: 24, line: "I'm the bad guy... duh",                      next: "" },
        { t: 28, line: "I like it when you take control",             next: "" },
      ],
    };

    let lyricAudio     = null;
    let lyricPlaying   = false;
    let lyricSelected  = null;
    let lyricInterval  = null;

    // Build song selector buttons
    (function buildLyricSelector() {
      const sel = document.getElementById('lyric-song-selector');
      const available = Object.keys(lyricData);
      available.forEach(title => {
        const btn = document.createElement('button');
        btn.className = 'lyric-song-card';
        btn.textContent = title;
        btn.onclick = () => selectLyricSong(title, btn);
        sel.appendChild(btn);
      });
    })();

    function selectLyricSong(title, btn) {
      stopLyricPlay();
      document.querySelectorAll('.lyric-song-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      lyricSelected = title;

      const songObj = songs.find(s => s.title === title);
      document.getElementById('lyric-song-name').textContent = title;
      document.getElementById('lyric-song-artist-name').textContent = songObj ? songObj.artist : '—';
      document.getElementById('lyric-progress-fill').style.width = '0%';

      document.getElementById('lyric-placeholder').style.display = '';
      document.getElementById('lyric-placeholder').textContent = '← Tekan ▶ untuk mulai';
      document.getElementById('lyric-current').style.display = 'none';
      document.getElementById('lyric-next').style.display = 'none';
      document.getElementById('lyric-time-hint').textContent = '00:00';
    }

    function toggleLyricPlay() {
      if (!lyricSelected) {
        document.getElementById('lyric-placeholder').textContent = '← Pilih dulu salah satu lagu';
        return;
      }
      if (lyricPlaying) { stopLyricPlay(); return; }

      const songObj = songs.find(s => s.title === lyricSelected);
      lyricAudio = new Audio(songObj ? songObj.src : '');
      lyricAudio.crossOrigin = 'anonymous';
      lyricPlaying = true;
      document.getElementById('lyric-play-btn').textContent = '⏸';
      document.getElementById('lyric-placeholder').style.display = 'none';
      document.getElementById('lyric-current').style.display = '';
      document.getElementById('lyric-next').style.display = '';

      let lastIdx = -1;
      const lyrics = lyricData[lyricSelected] || [];
      const fmt = t => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;

      function updateLyric() {
        if (!lyricPlaying) return;
        const cur = lyricAudio.currentTime || 0;
        const dur = lyricAudio.duration || 1;

        document.getElementById('lyric-progress-fill').style.width = (cur / dur * 100) + '%';
        document.getElementById('lyric-time-hint').textContent = fmt(cur);

        let activeIdx = -1;
        for (let i = lyrics.length - 1; i >= 0; i--) {
          if (cur >= lyrics[i].t) { activeIdx = i; break; }
        }

        if (activeIdx !== lastIdx && activeIdx >= 0) {
          lastIdx = activeIdx;
          const cur_el  = document.getElementById('lyric-current');
          const next_el = document.getElementById('lyric-next');
          cur_el.textContent  = lyrics[activeIdx].line;
          next_el.textContent = lyrics[activeIdx].next || '';
          cur_el.classList.remove('lyric-line-anim');
          void cur_el.offsetWidth; // reflow to restart animation
          cur_el.classList.add('lyric-line-anim');
        }
      }

      lyricInterval = setInterval(updateLyric, 100);
      lyricAudio.play().catch(() => {
        document.getElementById('lyric-current').textContent = '♫ [File audio belum tersedia]';
        document.getElementById('lyric-next').textContent    = 'Lirik tetap tampil saat play di atas 0:00';
        // Simulate time-based lyric if no audio file
        let fakeTime = 0;
        clearInterval(lyricInterval);
        lyricInterval = setInterval(() => {
          fakeTime += 0.1;
          document.getElementById('lyric-time-hint').textContent = fmt(fakeTime);
          let activeIdx = -1;
          for (let i = lyrics.length - 1; i >= 0; i--) {
            if (fakeTime >= lyrics[i].t) { activeIdx = i; break; }
          }
          if (activeIdx >= 0 && activeIdx !== lastIdx) {
            lastIdx = activeIdx;
            const cur_el  = document.getElementById('lyric-current');
            const next_el = document.getElementById('lyric-next');
            cur_el.textContent  = lyrics[activeIdx].line;
            next_el.textContent = lyrics[activeIdx].next || '';
            cur_el.classList.remove('lyric-line-anim');
            void cur_el.offsetWidth;
            cur_el.classList.add('lyric-line-anim');
          }
          if (fakeTime >= 35) stopLyricPlay();
        }, 100);
      });

      lyricAudio.addEventListener('ended', stopLyricPlay);
    }

    function stopLyricPlay() {
      lyricPlaying = false;
      clearInterval(lyricInterval);
      if (lyricAudio) { lyricAudio.pause(); lyricAudio = null; }
      document.getElementById('lyric-play-btn').textContent = '▶';
    }

    /* ─────────────────────────────────
       3. LOCAL AUDIO RECORDER
       (dengan LocalStorage persistence)
    ───────────────────────────────── */
    const LS_KEY = 'sonicflow_recordings';

    let recorder       = null;
    let recStream      = null;
    let recChunks      = [];
    let recTimerInt    = null;
    let recSeconds     = 0;
    let recRunning     = false;
    let recAudioCtx2   = null;
    let recAnalyser2   = null;
    let recAnimId2     = null;
    let recIndex       = 0;

    const recCanvas    = document.getElementById('rec-canvas');
    const recCtx2      = recCanvas.getContext('2d');
    const recVizWrap   = document.getElementById('rec-viz-wrap');
    const recBtn       = document.getElementById('rec-btn');
    const recBtnText   = document.getElementById('rec-btn-text');
    const recTimerEl   = document.getElementById('rec-timer');
    const recStatusEl  = document.getElementById('rec-status');
    const recList      = document.getElementById('recordings-list');
    const recEmpty     = document.getElementById('recordings-empty');

    /* ── localStorage helpers ── */
    function lsLoad() {
      try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
      catch { return []; }
    }
    function lsSave(arr) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch(e) {
        recStatusEl.textContent = 'Peringatan: storage penuh, rekaman tidak disimpan permanen.';
      }
    }
    function lsDelete(id) {
      const arr = lsLoad().filter(r => r.id !== id);
      lsSave(arr);
    }

    /* ── Restore recordings on page load ── */
    function restoreRecordings() {
      const saved = lsLoad();
      if (saved.length === 0) return;
      saved.forEach(rec => {
        if (rec.id >= recIndex) recIndex = rec.id; // keep counter consistent
        renderRecordingItem(rec.id, rec.label, rec.timeStr, rec.base64, rec.mimeType, false);
      });
      recEmpty.style.display = 'none';
      recStatusEl.textContent = `${saved.length} rekaman dimuat dari penyimpanan.`;
    }

    /* ── Render a single recording item ── */
    function renderRecordingItem(id, label, timeStr, base64, mimeType, prepend = true) {
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const bars = Array.from({length:18}, (_, i) =>
        `<rect x="${i * 4}" y="0" width="3" height="${4 + Math.random() * 20}" rx="1" fill="rgba(201,168,76,0.5)"/>`
      ).join('');
      const waveformSVG = `<svg class="rec-waveform" viewBox="0 0 72 28" xmlns="http://www.w3.org/2000/svg" style="align-self:center">${bars}</svg>`;

      const item = document.createElement('div');
      item.className = 'recording-item';
      item.dataset.recId = id;
      item.innerHTML = `
        ${waveformSVG}
        <div class="rec-item-label">${label}<small>${timeStr}</small></div>
        <button class="rec-play-btn" title="Putar" onclick="playRecording(this)">▶</button>
        <button class="rec-del-btn" title="Hapus" onclick="deleteRecording(this)">✕</button>
        <audio src="${dataUrl}"></audio>
      `;

      if (prepend) {
        recList.insertBefore(item, recList.firstChild);
      } else {
        recList.appendChild(item);
      }
    }

    function resizeRecCanvas() {
      recCanvas.width  = recCanvas.offsetWidth  * (window.devicePixelRatio || 1);
      recCanvas.height = recCanvas.offsetHeight * (window.devicePixelRatio || 1);
    }
    resizeRecCanvas();
    window.addEventListener('resize', resizeRecCanvas);

    async function toggleRecording() {
      if (recRunning) {
        stopRecording();
      } else {
        await startRecording();
      }
    }

    async function startRecording() {
      try {
        recStatusEl.textContent = 'Meminta izin mikrofon...';
        recStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        recAudioCtx2 = new (window.AudioContext || window.webkitAudioContext)();
        recAnalyser2 = recAudioCtx2.createAnalyser();
        recAnalyser2.fftSize = 128;
        recAnalyser2.smoothingTimeConstant = 0.8;
        const recSrc = recAudioCtx2.createMediaStreamSource(recStream);
        recSrc.connect(recAnalyser2);

        const mimeType = ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/webm','audio/ogg']
          .find(m => MediaRecorder.isTypeSupported(m)) || '';
        recorder   = new MediaRecorder(recStream, mimeType ? { mimeType } : {});
        recChunks  = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
        recorder.onstop = saveRecording;
        recorder.start(200);

        recRunning = true;
        recSeconds = 0;
        recBtn.classList.add('recording-active');
        recVizWrap.classList.add('recording');
        recBtnText.textContent = 'Stop Rekaman';
        recStatusEl.textContent = 'Sedang merekam...';

        recTimerInt = setInterval(() => {
          recSeconds++;
          const m = Math.floor(recSeconds / 60);
          const s = recSeconds % 60;
          recTimerEl.textContent = `${m}:${String(s).padStart(2,'0')} / 0:30`;
          if (recSeconds >= 30) stopRecording();
        }, 1000);

        drawRecVisualizer();
      } catch(e) {
        recStatusEl.textContent = 'Izin mikrofon ditolak.';
      }
    }

    function stopRecording() {
      recRunning = false;
      clearInterval(recTimerInt);
      if (recAnimId2) cancelAnimationFrame(recAnimId2);
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      if (recStream) recStream.getTracks().forEach(t => t.stop());
      if (recAudioCtx2) recAudioCtx2.close();
      recAudioCtx2 = null; recAnalyser2 = null;

      recCtx2.clearRect(0, 0, recCanvas.width, recCanvas.height);
      recVizWrap.classList.remove('recording');
      recBtn.classList.remove('recording-active');
      recBtnText.textContent = 'Mulai Rekam';
      recStatusEl.textContent = 'Rekaman selesai — sedang memproses...';
    }

    function saveRecording() {
      if (recChunks.length === 0) { recStatusEl.textContent = 'Tidak ada data terekam.'; return; }

      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(recChunks, { type: mimeType });

      // Convert blob → base64 for localStorage
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1]; // strip data URL prefix

        recIndex++;
        const id      = recIndex;
        const dur     = recSeconds;
        const label   = `Rekaman #${id}`;
        const timeStr = `${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')} — ${new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})}`;

        // Persist to localStorage
        const arr = lsLoad();
        arr.push({ id, label, timeStr, base64, mimeType });
        lsSave(arr);

        // Render in UI
        recEmpty.style.display = 'none';
        renderRecordingItem(id, label, timeStr, base64, mimeType, true);
        recStatusEl.textContent = `Rekaman #${id} tersimpan — dengarkan di bawah!`;
        recTimerEl.textContent  = '0:00 / 0:30';
      };
      reader.readAsDataURL(blob);
    }

    function playRecording(btn) {
      document.querySelectorAll('.recording-item audio').forEach(a => {
        if (!a.paused) { a.pause(); a.currentTime = 0; }
      });
      document.querySelectorAll('.rec-play-btn').forEach(b => b.textContent = '▶');

      const item  = btn.closest('.recording-item');
      const audio = item.querySelector('audio');

      if (audio.paused) {
        audio.play();
        btn.textContent = '⏸';
        audio.onended = () => { btn.textContent = '▶'; };
      } else {
        audio.pause();
        btn.textContent = '▶';
      }
    }

    function deleteRecording(btn) {
      const item  = btn.closest('.recording-item');
      const id    = Number(item.dataset.recId);
      const audio = item.querySelector('audio');
      if (audio) audio.pause();

      // Remove from localStorage
      lsDelete(id);

      item.style.animation = 'none';
      item.style.transition = 'opacity 0.3s, transform 0.3s';
      item.style.opacity    = '0';
      item.style.transform  = 'translateX(20px)';
      setTimeout(() => {
        item.remove();
        if (document.querySelectorAll('.recording-item').length === 0) {
          recEmpty.style.display = '';
        }
      }, 320);
    }

    // Load saved recordings when page is ready
    restoreRecordings();

    function drawRecVisualizer() {
      if (!recRunning || !recAnalyser2) return;
      recAnimId2 = requestAnimationFrame(drawRecVisualizer);

      const W = recCanvas.offsetWidth;
      const H = recCanvas.offsetHeight;
      const bufLen = recAnalyser2.frequencyBinCount;
      const data   = new Uint8Array(bufLen);
      recAnalyser2.getByteFrequencyData(data);

      recCtx2.clearRect(0, 0, recCanvas.width, recCanvas.height);
      const barCount = 40;
      const barW = (W - 2 * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const idx  = Math.floor(i / barCount * bufLen);
        const val  = data[idx] / 255;
        const barH = Math.max(3, val * H * 0.88);
        const x    = i * (barW + 2);
        const y    = (H - barH) / 2;

        // Red-to-gold palette for recording
        const r = Math.round(180 + val * 52);
        const g = Math.round(74  + val * 94);
        const b = Math.round(74  + val * 2);
        recCtx2.fillStyle = `rgba(${r},${g},${b},${0.55 + val * 0.45})`;
        recCtx2.beginPath();
        recCtx2.roundRect(x, y, barW, barH, Math.min(barW / 2, 3));
        recCtx2.fill();
      }
    }

    /* ════════════════════════════════
       SCROLL REVEAL (Intersection Observer)
    ════════════════════════════════ */
    const revealEls = document.querySelectorAll('.mood-card, .squad-card, .info-col');
    revealEls.forEach((el, i) => {
      el.style.opacity   = '0';
      el.style.transform = 'translateY(28px)';
      el.style.transition = `opacity 0.6s ${i * 0.07}s ease, transform 0.6s ${i * 0.07}s ease`;
    });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.opacity   = '1';
          e.target.style.transform = 'translateY(0)';
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach(el => observer.observe(el));

    /* ════════════════════════════════
       MICRO-INTERACTIONS
       Navbar scroll · Section reveal · Active link · Progress bar
    ════════════════════════════════ */
    const scrollProgressBar = document.createElement('div');
    scrollProgressBar.id = 'scroll-progress';
    document.body.prepend(scrollProgressBar);

    document.querySelectorAll('section').forEach(sec => sec.classList.add('section-fade-in'));

    const mainNav     = document.getElementById('main-nav');
    const navAnchors  = document.querySelectorAll('#nav-links a[href^="#"]');
    const allSections = document.querySelectorAll('section[id]');

    function handleScroll() {
      const scrollY  = window.scrollY;
      const docH     = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgressBar.style.width = (docH > 0 ? scrollY / docH * 100 : 0) + '%';

      if (scrollY > 60) mainNav.classList.add('scrolled');
      else              mainNav.classList.remove('scrolled');

      let current = '';
      allSections.forEach(sec => { if (scrollY >= sec.offsetTop - 120) current = sec.id; });
      navAnchors.forEach(a => {
        a.classList.toggle('nav-active', a.getAttribute('href') === '#' + current);
      });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('revealed'); sectionObserver.unobserve(e.target); }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.section-fade-in').forEach(sec => sectionObserver.observe(sec));

/* ═══════════════════════════════════════════════
   LOADING SCREEN  — isolated, tidak ganggu auth
═══════════════════════════════════════════════ */
(function () {
  const loader  = document.getElementById('sf-loader');
  const bar     = document.getElementById('sf-loader-bar');
  const txt     = document.getElementById('sf-loader-text');
  if (!loader) return;

  // Kunci scroll hanya via loader flag, bukan body.overflow langsung
  // supaya tidak bentrok dengan openAuthModal()
  loader.style.overflow = 'hidden';

  const steps = [
    { pct: 18,  msg: 'Menginisialisasi musik...' },
    { pct: 42,  msg: 'Memuat komponen...' },
    { pct: 68,  msg: 'Menghubungkan ke server...' },
    { pct: 88,  msg: 'Hampir selesai...' },
    { pct: 100, msg: 'Selamat datang!' },
  ];

  let i = 0;
  const tick = setInterval(() => {
    if (i >= steps.length) { clearInterval(tick); return; }
    const s = steps[i++];
    if (bar) bar.style.width = s.pct + '%';
    if (txt) txt.textContent = s.msg;
    if (s.pct === 100) {
      clearInterval(tick);
      setTimeout(() => {
        loader.classList.add('sf-hidden');
        // Hanya unlock scroll kalau TIDAK ada modal yang sedang buka
        const modalOpen = document.getElementById('auth-modal')?.classList.contains('visible');
        if (!modalOpen) document.body.style.overflow = '';
      }, 500);
    }
  }, 390);

  // Blokir scroll lewat body selama loading
  document.body.style.overflow = 'hidden';
})();

/* ═══════════════════════════════════════════════
   THEME TOGGLE — Light / Dark
═══════════════════════════════════════════════ */
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light-mode');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = isLight ? '☀️' : '🌙';
  try { localStorage.setItem('sf-theme', isLight ? 'light' : 'dark'); } catch(e) {}
}

// Restore theme on load (sebelum paint untuk hindari flicker)
(function () {
  try {
    if (localStorage.getItem('sf-theme') === 'light') {
      document.documentElement.classList.add('light-mode');
      // Icon akan diset setelah DOM siap
      document.addEventListener('DOMContentLoaded', () => {
        const icon = document.getElementById('theme-icon');
        if (icon) icon.textContent = '☀️';
      });
    }
  } catch(e) {}
})();
    /* ════════════════════════════════
       SUPABASE CONFIG
       ── Ganti nilai di bawah dengan Project URL & Anon Key dari dashboard Supabase kamu
       ── https://supabase.com → Settings → API
    ════════════════════════════════ */
    const SUPABASE_URL  = 'https://koyyvswptpnbvnhaxxqo.supabase.co';   // ← ganti ini
    const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtveXl2c3dwdHBuYnZuaGF4eHFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1Nzk5ODEsImV4cCI6MjA5MzE1NTk4MX0.SfNZ3av-7uxpmqoo1c2jbHk0_qfA2liu4-ixShtmDf8';                          // ← ganti ini
    const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

    /* ─ State Auth ─ */
    let currentUser     = null;
    let currentUsername = null;

    /* ═══════════════════════════════
       AUTH MODAL HELPERS
    ═══════════════════════════════ */
    let authMode = 'login'; // 'login' | 'register'

    function openAuthModal() {
      const overlay = document.getElementById('auth-modal-overlay');
      const modal   = document.getElementById('auth-modal');
      overlay.style.display = 'block';
      modal.style.display   = 'block';
      void overlay.offsetWidth;
      overlay.classList.add('visible');
      modal.classList.add('visible');
      document.body.style.overflow = 'hidden';
      clearAuthMessages();
    }
    function closeAuthModal() {
      const overlay = document.getElementById('auth-modal-overlay');
      const modal   = document.getElementById('auth-modal');
      overlay.classList.remove('visible');
      modal.classList.remove('visible');
      document.body.style.overflow = '';
      setTimeout(() => {
        overlay.style.display = 'none';
        modal.style.display   = 'none';
      }, 350);
    }
    function switchAuthTab(mode) {
      authMode = mode;
      document.getElementById('tab-login').classList.toggle('active',    mode === 'login');
      document.getElementById('tab-register').classList.toggle('active', mode === 'register');
      document.getElementById('auth-btn-text').textContent = mode === 'login' ? 'Masuk' : 'Daftar';
      document.getElementById('auth-switch-hint').innerHTML = mode === 'login'
        ? `Belum punya akun? <button onclick="switchAuthTab('register')">Daftar sekarang</button>`
        : `Sudah punya akun? <button onclick="switchAuthTab('login')">Masuk</button>`;
      clearAuthMessages();
    }
    function clearAuthMessages() {
      const err = document.getElementById('auth-error');
      const ok  = document.getElementById('auth-success');
      err.style.display = 'none';
      ok.style.display  = 'none';
    }
    function showAuthError(msg) {
      const el = document.getElementById('auth-error');
      el.textContent    = msg;
      el.style.display  = 'block';
      document.getElementById('auth-success').style.display = 'none';
    }
    function showAuthSuccess(msg) {
      const el = document.getElementById('auth-success');
      el.textContent   = msg;
      el.style.display = 'block';
      document.getElementById('auth-error').style.display = 'none';
    }
    function setAuthLoading(on) {
      document.getElementById('auth-btn-text').style.display    = on ? 'none' : 'inline';
      document.getElementById('auth-btn-spinner').style.display = on ? 'inline' : 'none';
      document.getElementById('auth-submit-btn').disabled       = on;
    }
    function togglePasswordVisibility() {
      const inp = document.getElementById('auth-password');
      inp.type  = inp.type === 'password' ? 'text' : 'password';
    }

    /* ── Username → fake email conversion ── */
    function usernameToEmail(username) {
      return username.trim().toLowerCase().replace(/\s+/g, '_') + '@sonicflow.com';
    }
    function validateUsername(username) {
      return /^[a-zA-Z0-9_]{3,30}$/.test(username.trim());
    }

    /* ─── Handle Register / Login submit ─── */
    async function handleAuthSubmit() {
      clearAuthMessages();
      const username = document.getElementById('auth-username').value.trim();
      const password = document.getElementById('auth-password').value;

      if (!username) { showAuthError('Username tidak boleh kosong.'); return; }
      if (!validateUsername(username)) {
        showAuthError('Username hanya boleh huruf, angka, dan underscore (3–30 karakter).');
        return;
      }
      if (password.length < 6) { showAuthError('Password minimal 6 karakter.'); return; }

      const email = usernameToEmail(username);
      setAuthLoading(true);

      if (authMode === 'register') {
        await handleRegister(username, email, password);
      } else {
        await handleLogin(email, password);
      }
      setAuthLoading(false);
    }

    async function handleRegister(username, email, password) {
      // Cek dulu apakah username sudah ada di tabel profiles
      const { data: existing } = await sb
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existing) {
        showAuthError('Username sudah terdaftar. Coba username lain.');
        return;
      }

      const { data, error } = await sb.auth.signUp({ email, password,
        options: { data: { username } }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          showAuthError('Username sudah terdaftar. Silakan masuk.');
        } else {
          showAuthError('Gagal daftar: ' + error.message);
        }
        return;
      }

      // Simpan profil username ke tabel profiles
      if (data.user) {
        await sb.from('profiles').upsert({
          id: data.user.id,
          username: username
        });
      }

      showAuthSuccess('Akun berhasil dibuat! Silakan masuk.');
      switchAuthTab('login');
    }

    async function handleLogin(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        showAuthError('Username atau password salah.');
        return;
      }
      currentUser = data.user;
      await loadUserProfile();
      onUserLoggedIn();
      closeAuthModal();
    }

    async function handleLogout() {
      await sb.auth.signOut();
      currentUser     = null;
      currentUsername = null;
      onUserLoggedOut();
    }

    async function loadUserProfile() {
      if (!currentUser) return;
      const { data } = await sb
        .from('profiles')
        .select('username')
        .eq('id', currentUser.id)
        .maybeSingle();
      currentUsername = data?.username || currentUser.user_metadata?.username || 'User';
    }

    /* ─── UI state saat login/logout ─── */
    function onUserLoggedIn() {
      // Update navbar button
      const btn   = document.getElementById('nav-auth-btn');
      btn.innerHTML = `<span id="nav-auth-icon">♪</span><span id="nav-auth-label">@${currentUsername}</span>`;
      btn.classList.add('logged-in');
      btn.onclick = handleLogout;

      // Show journal
      document.getElementById('journal-locked').style.display   = 'none';
      document.getElementById('journal-unlocked').style.display = 'block';
      document.getElementById('journal-username-display').textContent = '@' + currentUsername;

      // Load entries
      loadJournalEntries();
    }
    function onUserLoggedOut() {
      const btn = document.getElementById('nav-auth-btn');
      btn.innerHTML = `<span id="nav-auth-icon">♩</span><span id="nav-auth-label">Login</span>`;
      btn.classList.remove('logged-in');
      btn.onclick = openAuthModal;

      document.getElementById('journal-locked').style.display   = 'flex';
      document.getElementById('journal-unlocked').style.display = 'none';
      document.getElementById('journal-entries-list').innerHTML =
        '<div id="journal-entries-empty"><span>♩</span><p>Belum ada entri. Mulai tulis jurnalmu!</p></div>';
    }

    /* ─── Restore session on page load ─── */
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        currentUser = session.user;
        await loadUserProfile();
        onUserLoggedIn();
      }
    });

    /* ─── Listen to auth state changes ─── */
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        currentUser = session.user;
        if (!currentUsername) {
          await loadUserProfile();
          onUserLoggedIn();
        }
      } else if (event === 'SIGNED_OUT') {
        currentUser     = null;
        currentUsername = null;
        onUserLoggedOut();
      }
    });

    /* ═══════════════════════════════
       SOUL JOURNAL — Save & Load
    ═══════════════════════════════ */
    let selectedJournalMood = null;

    function selectJournalMood(el) {
      document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      selectedJournalMood = el.dataset.mood;
    }

    // Set tanggal hari ini di composer header
    function updateJournalDate() {
      const el = document.getElementById('journal-date-display');
      if (!el) return;
      const now = new Date();
      el.textContent = now.toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }
    updateJournalDate();

    // Char counter
    const journalInput = document.getElementById('journal-input');
    if (journalInput) {
      journalInput.addEventListener('input', function() {
        document.getElementById('journal-char-count').textContent =
          this.value.length + ' / 2000';
      });
    }

    async function saveJournal() {
      if (!currentUser) { openAuthModal(); return; }
      const text = document.getElementById('journal-input').value.trim();
      if (!text) return;

      document.getElementById('journal-save-text').style.display    = 'none';
      document.getElementById('journal-save-spinner').style.display = 'inline';
      document.getElementById('journal-save-btn').disabled          = true;

      const { error } = await sb.from('journals').insert({
        user_id:  currentUser.id,
        username: currentUsername,
        content:  text,
        mood:     selectedJournalMood || null,
        created_at: new Date().toISOString()
      });

      document.getElementById('journal-save-text').style.display    = 'inline';
      document.getElementById('journal-save-spinner').style.display = 'none';
      document.getElementById('journal-save-btn').disabled          = false;

      if (!error) {
        document.getElementById('journal-input').value = '';
        document.getElementById('journal-char-count').textContent = '0 / 2000';
        document.querySelectorAll('.mood-chip').forEach(c => c.classList.remove('selected'));
        selectedJournalMood = null;
        loadJournalEntries();

        // Mini konfirmasi animasi pada tombol
        const btn = document.getElementById('journal-save-btn');
        btn.style.background = '#4CAF50';
        btn.querySelector('#journal-save-text').textContent = '✓ Tersimpan!';
        setTimeout(() => {
          btn.style.background = '';
          btn.querySelector('#journal-save-text').textContent = 'Simpan';
        }, 1800);
      }
    }

    async function loadJournalEntries() {
      if (!currentUser) return;
      const { data, error } = await sb
        .from('journals')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(30);

      const list = document.getElementById('journal-entries-list');
      if (error || !data || data.length === 0) {
        list.innerHTML = '<div id="journal-entries-empty"><span>♩</span><p>Belum ada entri. Mulai tulis jurnalmu!</p></div>';
        return;
      }
      list.innerHTML = '';
      data.forEach(entry => {
        const el   = document.createElement('div');
        el.className = 'journal-entry';
        el.dataset.id = entry.id;

        const date = new Date(entry.created_at).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        const moodMap = { happy:'😊 Senang', sad:'😢 Sedih', excited:'⚡ Excited', calm:'🌿 Tenang', angry:'🔥 Marah' };
        const moodBadge = entry.mood
          ? `<span class="journal-entry-mood-badge">${moodMap[entry.mood] || entry.mood}</span>`
          : '';
        const isLong = entry.content.length > 200;
        const textId = 'jtxt-' + entry.id;

        el.innerHTML = `
          <div class="journal-entry-header">
            <div class="journal-entry-meta">
              ${moodBadge}
              <span class="journal-entry-date">${date}</span>
            </div>
            <button class="journal-entry-del" onclick="deleteJournalEntry('${entry.id}', this)" title="Hapus">✕</button>
          </div>
          <div class="journal-entry-text ${isLong ? 'clamped' : ''}" id="${textId}">${escapeHtml(entry.content)}</div>
          ${isLong ? `<button class="journal-entry-expand" onclick="toggleEntryExpand('${textId}', this)">Baca selengkapnya ↓</button>` : ''}
        `;
        list.appendChild(el);
      });
    }

    function toggleEntryExpand(textId, btn) {
      const el = document.getElementById(textId);
      if (el.classList.contains('clamped')) {
        el.classList.remove('clamped');
        btn.textContent = 'Sembunyikan ↑';
      } else {
        el.classList.add('clamped');
        btn.textContent = 'Baca selengkapnya ↓';
      }
    }

    async function deleteJournalEntry(id, btn) {
      if (!confirm('Hapus entri ini?')) return;
      const { error } = await sb.from('journals').delete().eq('id', id);
      if (!error) {
        const card = btn.closest('.journal-entry');
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity    = '0';
        card.style.transform  = 'translateX(20px)';
        setTimeout(() => { card.remove(); checkEntriesEmpty(); }, 320);
      }
    }

    function checkEntriesEmpty() {
      const list = document.getElementById('journal-entries-list');
      if (!list.querySelector('.journal-entry')) {
        list.innerHTML = '<div id="journal-entries-empty"><span>♩</span><p>Belum ada entri. Mulai tulis jurnalmu!</p></div>';
      }
    }

    function escapeHtml(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    /* Keyboard shortcut: tutup modal dengan Escape */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAuthModal();
    });

    /* ════════════════════════════════
       CUSTOM CURSOR
    ════════════════════════════════ */
    const cursor = document.getElementById('cursor');
    const cursorRing = document.getElementById('cursor-ring');
    let cx = 0, cy = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', e => { cx = e.clientX; cy = e.clientY; });

    (function animateCursor() {
      rx += (cx - rx) * 0.18;
      ry += (cy - ry) * 0.18;
      cursor.style.left = cx + 'px';
      cursor.style.top  = cy + 'px';
      cursorRing.style.left = rx + 'px';
      cursorRing.style.top  = ry + 'px';
      requestAnimationFrame(animateCursor);
    })();

    document.querySelectorAll('a, button, .mood-card, .squad-card, .ans-btn').forEach(el => {
      el.addEventListener('mouseenter', () => { cursor.style.transform = 'translate(-50%,-50%) scale(2.2)'; });
      el.addEventListener('mouseleave', () => { cursor.style.transform = 'translate(-50%,-50%) scale(1)'; });
    });

    /* ════════════════════════════════
       TOUCH DETECTION — Nonaktifkan cursor di HP/Tablet
    ════════════════════════════════ */
    function isTouchDevice() {
      return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    }
    if (isTouchDevice()) {
      document.getElementById('cursor').style.display      = 'none';
      document.getElementById('cursor-ring').style.display = 'none';
      document.body.style.cursor = 'auto';
      document.querySelectorAll(
        '.mood-card,.btn-outline,.ans-btn,.squad-card,nav ul a,.info-col a,' +
        '.practice-tab,#mic-toggle-btn,#rec-btn,#play-btn'
      ).forEach(el => { el.style.cursor = 'pointer'; });
      document.querySelectorAll('a,button').forEach(el => { el.style.cursor = 'pointer'; });
    }

    /* ════════════════════════════════
       HAMBURGER MENU
    ════════════════════════════════ */
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const navOverlay   = document.getElementById('nav-overlay');
    const drawerClose  = document.getElementById('drawer-close');

    function openDrawer() {
      mobileDrawer.classList.add('open');
      navOverlay.style.display = 'block';
      void navOverlay.offsetWidth;
      navOverlay.classList.add('visible');
      hamburgerBtn.classList.add('open');
      hamburgerBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
      mobileDrawer.classList.remove('open');
      navOverlay.classList.remove('visible');
      hamburgerBtn.classList.remove('open');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      setTimeout(() => { navOverlay.style.display = 'none'; }, 350);
    }
    hamburgerBtn.addEventListener('click', () => {
      mobileDrawer.classList.contains('open') ? closeDrawer() : openDrawer();
    });
    drawerClose.addEventListener('click', closeDrawer);
    navOverlay.addEventListener('click', closeDrawer);
    window.addEventListener('resize', () => { if (window.innerWidth > 860) closeDrawer(); });


    const canvas = document.getElementById('rain-canvas');
    const ctx = canvas.getContext('2d');
    let drops = [];

    function initCanvas() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      drops = [];
      for (let i = 0; i < 90; i++) {
        drops.push({
          x:       Math.random() * canvas.width,
          y:       Math.random() * canvas.height,
          len:     Math.random() * 70 + 20,
          speed:   Math.random() * 0.9 + 0.25,
          opacity: Math.random() * 0.2 + 0.04,
          width:   Math.random() * 0.8 + 0.3
        });
      }
    }

    function animateRain() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drops.forEach(d => {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * 0.1, d.y + d.len);
        ctx.strokeStyle = `rgba(201,168,76,${d.opacity})`;
        ctx.lineWidth = d.width;
        ctx.stroke();
        d.y += d.speed;
        if (d.y > canvas.height + d.len) {
          d.y = -d.len;
          d.x = Math.random() * canvas.width;
        }
      });
      requestAnimationFrame(animateRain);
    }

    initCanvas();
    animateRain();
    window.addEventListener('resize', initCanvas);

    /* ════════════════════════════════
       BLOB + WAVE FOLLOW CURSOR
    ════════════════════════════════ */
    const blobSvg = document.getElementById('blob-svg');
    const homeSection = document.getElementById('home');
    let blobX = 400, blobY = 300, mbX = 400, mbY = 300;

    homeSection.addEventListener('mousemove', e => {
      const r = homeSection.getBoundingClientRect();
      mbX = e.clientX - r.left - 170;
      mbY = e.clientY - r.top  - 170;
    });

    (function animateBlob() {
      blobX += (mbX - blobX) * 0.07;
      blobY += (mbY - blobY) * 0.07;
      blobSvg.style.left = blobX + 'px';
      blobSvg.style.top  = blobY + 'px';

      const t = Date.now() / 1300;
      const a = Math.sin(t) * 18;
      const b = Math.cos(t * 0.7) * 12;

      document.getElementById('wv1').setAttribute('d',
        `M 30 ${170+a} Q 80 ${130-a} 130 ${170+a} Q 180 ${210+a} 230 ${170-a} Q 270 ${130+a} 310 ${170+a}`);
      document.getElementById('wv2').setAttribute('d',
        `M 20 ${190-b} Q 75 ${145+b} 130 ${190-b} Q 185 ${230-b} 240 ${190+b} Q 285 ${148-b} 320 ${190-b}`);
      document.getElementById('wv3').setAttribute('d',
        `M 30 ${152+b} Q 85 ${112-b} 135 ${152+b} Q 185 ${190+b} 235 ${152-b} Q 280 ${112+b} 315 ${152+b}`);

      requestAnimationFrame(animateBlob);
    })();

    /* ════════════════════════════════
       MUSIK / SPOTIFY MOOD
       ─────────────────────────────
       DEVELOPER: Isi playlist ID kamu di objek playlists di bawah.
       Format ID: bagian akhir URL Spotify, contoh:
       https://open.spotify.com/playlist/37i9dQZF1DX3YSRoSdA634
                                          ↑ ini ID-nya
    ════════════════════════════════ */
    const playlists = {
      sad:   '7gInDmUbitTujZnfkZP5cL',    // ← Tempel Spotify Playlist ID untuk mood Sad
      happy: '1F4Blteq0gK70zV7YMcVic',  // ← Tempel Spotify Playlist ID untuk mood Happy
      angry: '13JLEbC6DSWdjOaWAWYA9u',  // ← Tempel Spotify Playlist ID untuk mood Angry
      bored: '79CVfGtYLBRongKkFxB6o3'   // ← Tempel Spotify Playlist ID untuk mood Bored
    };

    function selectMood(card, mood) {
      document.querySelectorAll('.mood-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      const ph    = document.getElementById('spotify-ph');
      const embed = document.getElementById('spotify-embed');
      const id    = playlists[mood];

      if (id && !id.startsWith('YOUR_')) {
        ph.style.display    = 'none';
        embed.style.display = 'block';
        embed.innerHTML = `<iframe
          src="https://open.spotify.com/embed/playlist/${id}?utm_source=generator&theme=0"
          width="100%" height="352" frameBorder="0" allowfullscreen
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"></iframe>`;
      } else {
        ph.style.display    = 'block';
        embed.style.display = 'none';
        ph.innerHTML = `🎵 Playlist untuk mood <strong>${mood.toUpperCase()}</strong> belum diisi.<br>
          <small style="opacity:0.65;">Tambahkan Spotify Playlist ID di variabel <code>playlists.${mood}</code> dalam script.</small>`;
      }
    }

    /* ════════════════════════════════
       MINI GAME — DEVELOPER DATA EDITION
       ─────────────────────────────────
       DEVELOPER: Isi data lagu di array `songs` di bawah.
       Format tiap objek:
       {
         title:   "Judul Lagu",
         artist:  "Nama Artis",
         src:     "audio/nama-file.mp3",
         options: ["Pilihan A","Pilihan B","Pilihan C","Pilihan D"]
       }
       Urutan options bebas — sistem akan otomatis tahu mana yang benar.
    ════════════════════════════════ */
    const songs = [
      {
        title:   "Starboy",
        artist:  "The Weeknd, Daft Punk",
        src:     "lagu/starboy.mp3",
        options: ["Blinding Lights", "Save Your Tears", "Starboy", "In Your Eyes"]
      },
      {
        title:   "Risk It All",
        artist:  "Bruno Mars",
        src:     "lagu/riskitall.mp3",
        options: ["Perfect", "Risk It All", "Shape of You", "Thinking Out Loud"]
      },
      {
        title:   "Minggu depan atau sekarang",
        artist:  "Sandra Lucia de Souza",
        src:     "lagu/mingdep.mp3",
        options: ["Physical", "Levitating", "Don't Start Now", "Minggu depan atau sekarang"]
      },
      {
        title:   "Menteri durmagati",
        artist:  "KAJAWI",
        src:     "lagu/mendur.mp3",
        options: ["Rakyat Pres", "Menteri durmagati", "Maju Maju", "Stay Dumag"]
      },
      {
        title:   "Buried Alive",
        artist:  "A7X",
        src:     "lagu/buriedalive.mp3",
        options: ["21 Guns", "Gunslinger", "Disenchanted", "Buried Alive"]
      },
      {
        title:   "Fix you",
        artist:  "Coldplay",
        src:     "lagu/fixyou.mp3",
        options: ["Fix you", "Adore You", "Watermelon Sugar", "Sign of the Times"]
      },
      {
        title:   "Feed from desire",
        artist:  "Gala, Molella, Phil Jay",
        src:     "lagu/feedfd.mp3",
        options: ["deja vu", "drivers license", "good 4 u", "Feed from desire"]
      },
      {
        title:   "Akhir tak bahagia",
        artist:  "Misellia",
        src:     "lagu/akhirgbaha.mp3",
        options: ["Akhir tak bahagia", "Menerima luka", "Hargai aku", "Sekuat hatimu"]
      },
      {
        title:   "beauty and a beat",
        artist:  "Justin Bieber, Nicki Minaj",
        src:     "lagu/beautybet.mp3",
        options: ["Easy On Me", "Hello my girl", "Rolling in the Deep", "beauty and a beat"]
      },
      {
        title:   "King Manchester United",
        artist:  "oLil Nas X",
        src:     "lagu/mu.mp3",
        options: ["Industry Baby", "Sun Goes Down", "That's What I Want", "King Manchester United"]
      },
      {
        title:   "Raiso ngapusi",
        artist:  "La tasya, Aryan saputra",
        src:     "lagu/raisongaps.mp3",
        options: ["Raiso ngapusi", "Saktenane", "Rasah bali", "Akhire lungo"]
      },
      {
        title:   "Merindukanmu",
        artist:  "D'MASIV",
        src:     "lagu/merindukan.mp3",
        options: ["Awas jatuh cinta", "Merindukanmu", "Sampai kau jadi milikku", "Tentang kamu"]
      },
      {
        title:   "Gadis manis kalimantan",
        artist:  "Ajeng febria, Brodin",
        src:     "lagu/gadiskal.mp3",
        options: ["Gadis manis kalimantan", "Salahmu sendiri", "Kasmaran", "Jangan tunggu lama lama"]
      },
      {
        title:   "Abadi",
        artist:  "Ajeng febria, Brodin",
        src:     "lagu/abadi.mp3",
        options: ["Abadi", "Salahmu sendiri", "cinta sendirian", "Jatuh cinta"]
      }
    ];

    // ─── Build correct index from options array ───
    songs.forEach(s => { s.correct = s.options.indexOf(s.title); });

    // ─── Audio Visualizer Setup ───
    const vizCanvas = document.getElementById('viz-canvas');
    const vizCtx    = vizCanvas.getContext('2d');
    const vizIdle   = document.getElementById('viz-idle');
    let audioCtx    = null;
    let analyser    = null;
    let vizSource   = null;
    let vizRunning  = false;

    function initVisualizer(audioEl) {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;
        analyser.connect(audioCtx.destination);
      }
      if (vizSource) { try { vizSource.disconnect(); } catch(e) {} }
      vizSource = audioCtx.createMediaElementSource(audioEl);
      vizSource.connect(analyser);
      if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    function resizeVizCanvas() {
      vizCanvas.width  = vizCanvas.offsetWidth  * window.devicePixelRatio;
      vizCanvas.height = vizCanvas.offsetHeight * window.devicePixelRatio;
      vizCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    resizeVizCanvas();
    window.addEventListener('resize', resizeVizCanvas);

    function drawVisualizer() {
      if (!vizRunning || !analyser) return;
      requestAnimationFrame(drawVisualizer);
      const W = vizCanvas.offsetWidth;
      const H = vizCanvas.offsetHeight;
      const bufLen = analyser.frequencyBinCount;
      const data   = new Uint8Array(bufLen);
      analyser.getByteFrequencyData(data);
      vizCtx.clearRect(0, 0, W, H);
      const barCount = 48;
      const gap      = 3;
      const barW     = (W - gap * (barCount - 1)) / barCount;
      for (let i = 0; i < barCount; i++) {
        const idx  = Math.floor(i / barCount * bufLen);
        const val  = data[idx] / 255;
        const barH = Math.max(3, val * H * 0.92);
        const x    = i * (barW + gap);
        const y    = (H - barH) / 2;
        const r    = Math.round(201 - val * 140);
        const g    = Math.round(168 - val * 76);
        const b    = Math.round(76  + val * 20);
        vizCtx.fillStyle = `rgba(${r},${g},${b},${0.55 + val * 0.45})`;
        const radius = Math.min(barW / 2, 3);
        vizCtx.beginPath();
        vizCtx.roundRect(x, y, barW, barH, radius);
        vizCtx.fill();
      }
    }

    function startVisualizer() {
      vizIdle.style.display = 'none';
      vizRunning = true;
      drawVisualizer();
    }

    function stopVisualizer() {
      vizRunning = false;
      vizCtx.clearRect(0, 0, vizCanvas.offsetWidth, vizCanvas.offsetHeight);
      vizIdle.style.display = 'flex';
    }

    // ─── Game State ───
    const game = { round: 0, score: 0, streak: 0, playing: false, timer: null, currentAudio: null };

    /* ════════════════════════════════
       HIGH SCORE — localStorage
    ════════════════════════════════ */
    const HS_KEY = 'sonicflow_highscore';
    function getHighScore()       { return parseInt(localStorage.getItem(HS_KEY) || '0'); }
    function saveHighScore(score) { localStorage.setItem(HS_KEY, score); }
    function updateHighScoreDisplay() {
      const el = document.getElementById('sc-highscore');
      if (el) el.textContent = getHighScore();
    }
    updateHighScoreDisplay();
    const hsBanner = document.createElement('div');
    hsBanner.id = 'new-highscore-banner';
    hsBanner.textContent = '★ New Best!';
    document.body.appendChild(hsBanner);

    document.getElementById('sc-total').textContent = songs.length;

    function renderRound() {
      const s = songs[game.round % songs.length];
      document.getElementById('sc-round').textContent  = (game.round % songs.length) + 1;
      document.getElementById('sc-score').textContent  = game.score;
      document.getElementById('sc-streak').textContent = game.streak;

      const ans = document.getElementById('answers');
      ans.innerHTML = '';
      s.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className   = 'ans-btn';
        btn.textContent = opt;
        btn.onclick     = () => checkAnswer(i, btn, s);
        ans.appendChild(btn);
      });
    }

    function togglePlay() {
      const btn = document.getElementById('play-btn');
      const s   = songs[game.round % songs.length];

      if (game.playing) {
        if (game.currentAudio) game.currentAudio.pause();
        game.playing = false;
        btn.textContent = '▶';
        stopVisualizer();
        document.getElementById('song-title').textContent  = 'Dijeda — tekan ▶ lanjut';
        document.getElementById('song-artist').textContent = '—';
        return;
      }

      // Stop previous audio
      if (game.currentAudio) { game.currentAudio.pause(); game.currentAudio.currentTime = 0; }

      const audio = new Audio(s.src);
      audio.crossOrigin = 'anonymous';
      game.currentAudio = audio;
      try { initVisualizer(audio); } catch(e) {}
      audio.play().then(() => {
        startVisualizer();
      }).catch(() => {
        document.getElementById('song-title').textContent  = '♫ [File audio belum diisi developer]';
        document.getElementById('song-artist').textContent = 'Tebak judulnya tetap bisa!';
      });

      game.playing = true;
      btn.textContent = '⏸';
      document.getElementById('song-title').textContent  = '♫ Dengarkan baik-baik...';
      document.getElementById('song-artist').textContent = 'Tebak judul lagunya!';

      const fill   = document.getElementById('progress-fill');
      const timeEl = document.getElementById('progress-time');

      const fmt = t => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;

      function updateProgress() {
        if (!game.playing || !audio || audio.paused) return;
        const cur = audio.currentTime;
        const dur = audio.duration || 0;
        fill.style.width = dur ? (cur / dur * 100) + '%' : '0%';
        timeEl.textContent = dur ? `${fmt(cur)} / ${fmt(dur)}` : '—';
        requestAnimationFrame(updateProgress);
      }
      audio.addEventListener('loadedmetadata', updateProgress);
      updateProgress();

      audio.addEventListener('ended', () => {
        game.playing = false;
        btn.textContent = '▶';
        stopVisualizer();
        document.getElementById('song-title').textContent  = 'Audio selesai — pilih jawaban!';
        document.getElementById('song-artist').textContent = '—';
      });
    }

    function checkAnswer(i, btn, song) {
      document.querySelectorAll('.ans-btn').forEach(b => b.disabled = true);
      if (game.currentAudio) { game.currentAudio.pause(); game.currentAudio.currentTime = 0; }
      game.playing = false;
      stopVisualizer();
      document.getElementById('play-btn').textContent = '▶';

      const ok = i === song.correct;
      btn.classList.add(ok ? 'correct' : 'wrong');
      if (!ok) document.querySelectorAll('.ans-btn')[song.correct].classList.add('reveal');

      if (ok) {
        game.score  += 10 + game.streak * 2;
        game.streak += 1;
        showFeedback('✓', '#4CAF50');
        triggerScorePulse();
        spawnParticles();
      } else {
        game.streak = 0;
        showFeedback('✗', '#f55');
      }

      document.getElementById('song-artist').textContent = song.artist;
      document.getElementById('sc-score').textContent    = game.score;
      document.getElementById('sc-streak').textContent   = game.streak;

      const isLast = (game.round + 1) >= songs.length;
      if (game.score > getHighScore()) {
        saveHighScore(game.score);
        updateHighScoreDisplay();
        showNewHighScoreBanner();
      }

      setTimeout(() => {
        if (isLast) {
          document.getElementById('song-title').textContent  = `🏆 Game selesai! Score: ${game.score}`;
          document.getElementById('song-artist').textContent = 'Refresh halaman untuk main lagi';
        } else {
          game.round++;
          document.getElementById('progress-fill').style.width = '0%';
          document.getElementById('progress-time').textContent  = '0:00 / 0:00';
          document.getElementById('song-title').textContent     = 'Tekan ▶ untuk ronde berikutnya';
          document.getElementById('song-artist').textContent    = '—';
          renderRound();
        }
      }, 1800);
    }

    function showFeedback(sym, color) {
      const pop = document.getElementById('feedback-pop');
      pop.textContent = sym;
      pop.style.color = color;
      pop.style.transform = 'translate(-50%,-50%) scale(1)';
      pop.style.opacity   = '1';
      setTimeout(() => {
        pop.style.transform = 'translate(-50%,-50%) scale(0)';
        pop.style.opacity   = '0';
      }, 800);
    }

    function triggerScorePulse() {
      const el = document.getElementById('sc-score');
      if (!el) return;
      el.classList.remove('score-pulse');
      void el.offsetWidth;
      el.classList.add('score-pulse');
      el.addEventListener('animationend', () => el.classList.remove('score-pulse'), { once: true });
    }

    function spawnParticles() {
      const container = document.getElementById('particle-burst');
      if (!container) return;
      const ox = window.innerWidth / 2, oy = window.innerHeight / 2;
      const colors = ['#C9A84C','#E8C87A','#ffffff','#4CAF50','#80d883'];
      for (let i = 0; i < 22; i++) {
        const p     = document.createElement('div');
        p.className = 'particle';
        const angle = Math.random() * Math.PI * 2;
        const dist  = 80 + Math.random() * 180;
        const tx    = Math.cos(angle) * dist;
        const ty    = Math.sin(angle) * dist;
        const dur   = (0.6 + Math.random() * 0.5).toFixed(2) + 's';
        const delay = (Math.random() * 0.15).toFixed(2) + 's';
        const size  = (4 + Math.random() * 6).toFixed(1) + 'px';
        const color = colors[Math.floor(Math.random() * colors.length)];
        p.style.cssText = `left:${ox}px;top:${oy}px;--tx:${tx}px;--ty:${ty}px;--dur:${dur};animation-delay:${delay};background:${color};width:${size};height:${size};box-shadow:0 0 6px ${color};`;
        container.appendChild(p);
        setTimeout(() => p.remove(), 1200);
      }
    }

    function showNewHighScoreBanner() {
      const banner = document.getElementById('new-highscore-banner');
      if (!banner) return;
      banner.classList.add('show');
      setTimeout(() => banner.classList.remove('show'), 2200);
    }

    renderRound();

    /* ════════════════════════════════
       SQUAD GALLERY
       ─────────────────────────────
       DEVELOPER: Ubah data anggota tim di array squadData.
       Untuk foto nyata: ganti properti `emoji` dengan `img: 'path/ke/foto.jpg'`
    ════════════════════════════════ */
    const squadData = [
      { name: "M. Renno Agustovano", role: "Lead Developer",    motto: "Code is poetry in motion",       img: "picture/reno.jpeg", emoji: "🎵" },
      { name: "Marisa Al Zahra", role: "Programmer",    motto: "Batu besar yang menghalangi jalanmu bisa jadi batu pijakan kalau kamu mau melihatnya dari sudut berbeda", img: "picture/marisa.jpeg", emoji: "🎸" },
      { name: "Damara Keisya R.", role: "Programmer",  motto: "Focus on your goal, dont look in any direction but ahead",       img: "picture/damara.jpeg", emoji: "🎹" },
      { name: "Ajeng Candra Lokasari", role: "Programmer",      motto: "Kegagalan adalah bumbu yang memberi rasa pada kesuksesan",     img: "picture/ajeng.jpeg", emoji: "🎷" },
      { name: "Hendro Nur Saputra", role: "Programmer",    motto: "Hendro tanpa kata-kata bagaikan Singa tanpa mahkota",      img: "picture/hendro.jpeg", emoji: "🥁" },
      { name: "Anindya Livya Azzahra", role: "Programmer",     motto: "Niatnya berubah, actionya masih buffering realita",        img: "picture/livy.jpeg", emoji: "🎺" },
      { name: "Aydin Akmal Daffa", role: "Programmer",   motto: "Jangan biarkan hari buruk membuatmu merasa punya kehidupan yang buruk.",            img: "picture/aydin.jpeg", emoji: "🎻" },
      { name: "Gendis Kirana Larasati", role: "Programmer",   motto: "Sukses adalah jumlah dari usaha-usaha kecil yang diulang hari demi hari",         img: "picture/gendis.jpeg", emoji: "🎤" }
    ];

    const grid = document.getElementById('squad-grid');
    squadData.forEach(m => {
      const card = document.createElement('div');
      card.className = 'squad-card';
      const photoContent = m.img
        ? `<img src="${m.img}" alt="Foto ${m.name}" loading="lazy">`
        : m.emoji;
      card.innerHTML = `
        <div class="squad-ph">${photoContent}</div>
        <div class="squad-overlay">
          <div class="sq-name">${m.name}</div>
          <div class="sq-role">${m.role}</div>
          <div class="sq-motto">"${m.motto}"</div>
        </div>`;
      grid.appendChild(card);
    });

    /* ════════════════════════════════
       PRACTICE MODE
    ════════════════════════════════ */

    // ── Tab Switcher ──
    function switchPracticeTab(tab, el) {
      document.querySelectorAll('.practice-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      document.getElementById(tab + '-panel').classList.add('active');
    }

    /* ─────────────────────────────────
       1. MICROPHONE VISUALIZER
    ───────────────────────────────── */
    let micStream     = null;
    let micAudioCtx   = null;
    let micAnalyser   = null;
    let micSource     = null;
    let micRunning    = false;
    let micAnimId     = null;

    const micCanvas   = document.getElementById('mic-canvas');
    const micCtx      = micCanvas.getContext('2d');
    const micVizWrap  = document.getElementById('mic-viz-wrap');
    const micIdleMsg  = document.getElementById('mic-idle-msg');
    const micDbFill   = document.getElementById('mic-db-fill');
    const micDbVal    = document.getElementById('mic-db-val');
    const micStatus   = document.getElementById('mic-status');
    const micToggleBtn= document.getElementById('mic-toggle-btn');
    const micBtnText  = document.getElementById('mic-btn-text');

    function resizeMicCanvas() {
      micCanvas.width  = micCanvas.offsetWidth  * (window.devicePixelRatio || 1);
      micCanvas.height = micCanvas.offsetHeight * (window.devicePixelRatio || 1);
    }
    resizeMicCanvas();
    window.addEventListener('resize', resizeMicCanvas);

    async function toggleMic() {
      if (micRunning) {
        stopMic();
      } else {
        await startMic();
      }
    }

    async function startMic() {
      try {
        micStatus.textContent = 'Meminta izin mikrofon...';
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        micAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        micAnalyser = micAudioCtx.createAnalyser();
        micAnalyser.fftSize = 256;
        micAnalyser.smoothingTimeConstant = 0.75;
        micSource = micAudioCtx.createMediaStreamSource(micStream);
        micSource.connect(micAnalyser);

        micRunning = true;
        micIdleMsg.style.display = 'none';
        micVizWrap.classList.add('active-mic');
        micToggleBtn.classList.add('listening');
        micBtnText.textContent = 'Matikan Mikrofon';
        micStatus.textContent  = 'Mikrofon aktif — nyanyilah!';

        drawMicVisualizer();
      } catch(e) {
        micStatus.textContent = 'Izin mikrofon ditolak atau tidak tersedia.';
      }
    }

    function stopMic() {
      micRunning = false;
      if (micAnimId) cancelAnimationFrame(micAnimId);
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (micAudioCtx) micAudioCtx.close();
      micStream = null; micAudioCtx = null; micAnalyser = null; micSource = null;

      micCtx.clearRect(0, 0, micCanvas.width, micCanvas.height);
      micVizWrap.classList.remove('active-mic');
      micToggleBtn.classList.remove('listening');
      micIdleMsg.style.display = 'flex';
      micBtnText.textContent = 'Aktifkan Mikrofon';
      micStatus.textContent  = 'Mikrofon dimatikan';
      micDbFill.style.width  = '0%';
      micDbVal.textContent   = '— dB';
    }

    function drawMicVisualizer() {
      if (!micRunning || !micAnalyser) return;
      micAnimId = requestAnimationFrame(drawMicVisualizer);

      const W = micCanvas.offsetWidth;
      const H = micCanvas.offsetHeight;
      const bufLen = micAnalyser.frequencyBinCount;
      const data   = new Uint8Array(bufLen);
      micAnalyser.getByteFrequencyData(data);

      micCtx.clearRect(0, 0, micCanvas.width, micCanvas.height);

      // Waveform bars — circular burst style
      const barCount = 64;
      const barW = (W - 2 * (barCount - 1)) / barCount;

      // Compute RMS for dB meter
      let sumSq = 0;
      data.forEach(v => sumSq += (v / 255) * (v / 255));
      const rms = Math.sqrt(sumSq / bufLen);
      const db  = rms > 0 ? Math.round(20 * Math.log10(rms)) : -Infinity;
      const dbPct = Math.min(100, Math.max(0, (db + 60) / 60 * 100));
      micDbFill.style.width = dbPct + '%';
      micDbVal.textContent  = isFinite(db) ? db + ' dB' : '— dB';

      for (let i = 0; i < barCount; i++) {
        const idx  = Math.floor(i / barCount * bufLen);
        const val  = data[idx] / 255;
        const barH = Math.max(3, val * H * 0.9);
        const x    = i * (barW + 2);
        const y    = (H - barH) / 2;

        // Color shift: green → gold → red based on level
        const r = Math.round(26  + val * 230);
        const g = Math.round(92  + val * 20);
        const b = Math.round(54  - val * 40);
        micCtx.fillStyle = `rgba(${r},${g},${b},${0.6 + val * 0.4})`;

        const radius = Math.min(barW / 2, 3);
        micCtx.beginPath();
        micCtx.roundRect(x, y, barW, barH, radius);
        micCtx.fill();

        // Reflection
        micCtx.fillStyle = `rgba(${r},${g},${b},${0.1 + val * 0.1})`;
        micCtx.beginPath();
        micCtx.roundRect(x, H / 2 + barH / 2 + 2, barW, barH * 0.3, radius);
        micCtx.fill();
      }
    }

    /* ─────────────────────────────────
       2. LYRIC DISPLAY
    ───────────────────────────────── */

    // Sample lyrics keyed by song title (timed in seconds)
    const lyricData = {
      "Blinding Lights": [
        { t: 0,   line: "♪ Intro — bersiaplah...",                   next: "" },
        { t: 4,   line: "I been tryna call",                          next: "I been on my own for long enough" },
        { t: 7,   line: "I been on my own for long enough",           next: "Maybe you can show me how to love, maybe" },
        { t: 11,  line: "Maybe you can show me how to love, maybe",   next: "I'm going through withdrawals" },
        { t: 15,  line: "I'm going through withdrawals",              next: "" },
        { t: 19,  line: "You don't even have to do too much",         next: "You can turn me on with just a touch, baby" },
        { t: 23,  line: "You can turn me on with just a touch, baby", next: "I look around and sin is all I see" },
        { t: 27,  line: "I'm blinded by the lights",                  next: "No, I can't sleep until I feel your touch" },
        { t: 31,  line: "No, I can't sleep until I feel your touch",  next: "" },
      ],
      "Shape of You": [
        { t: 0,  line: "♪ Intro...",                                  next: "" },
        { t: 4,  line: "The club isn't the best place to find a lover", next: "So the bar is where I go" },
        { t: 8,  line: "So the bar is where I go",                    next: "Me and my friends at the table doing shots" },
        { t: 12, line: "Me and my friends at the table doing shots",  next: "Drinking fast and then we talk slow" },
        { t: 16, line: "And you come over and start up a conversation with just me", next: "" },
        { t: 20, line: "And trust me I'll give it a chance now",      next: "Take my hand, stop, put Van the Man on the jukebox" },
        { t: 24, line: "I'm in love with the shape of you",           next: "We push and pull like a magnet do" },
        { t: 28, line: "We push and pull like a magnet do",           next: "Although my heart is falling too" },
        { t: 32, line: "I'm in love with your body",                  next: "" },
      ],
      "Levitating": [
        { t: 0,  line: "♪ Intro...",                                  next: "" },
        { t: 5,  line: "If you wanna run away with me, I know a galaxy", next: "And I can take you for a ride" },
        { t: 10, line: "I had a premonition that we fell into a rhythm", next: "Where the music don't stop for life" },
        { t: 15, line: "Glitter in the sky, glitter in my eyes",      next: "Shining just the way I like" },
        { t: 19, line: "If you're feeling like you need a little guidance", next: "Let me be your pilot" },
        { t: 23, line: "I believe that you are my universe",          next: "" },
        { t: 27, line: "I'm levitating",                              next: "The Milky Way, we're renegading" },
        { t: 31, line: "You can't stop my shining",                   next: "" },
      ],
      "Stay": [
        { t: 0,  line: "♪ Intro...",                                  next: "" },
        { t: 4,  line: "Waiting for the time to pass you by",         next: "Hope the winds of change will change your mind" },
        { t: 9,  line: "I could give a thousand reasons why",         next: "Don't you open up that window" },
        { t: 13, line: "Don't you let the rain come in",              next: "Stay with me a little longer" },
        { t: 17, line: "I do believe that you could change your mind", next: "" },
        { t: 21, line: "Stay, I want you to stay",                    next: "Stay, I want you to stay" },
        { t: 25, line: "Run away, but we're running in circles",      next: "" },
        { t: 29, line: "We're running in circles",                    next: "" },
      ],
      "Bad Guy": [
        { t: 0,  line: "♪ Intro...",                                  next: "" },
        { t: 4,  line: "White shirt now red, my bloody nose",         next: "Sleeping, you're on your tippy toes" },
        { t: 8,  line: "Creeping around like no one knows",           next: "Think you're so criminal" },
        { t: 12, line: "Think you're so criminal",                    next: "" },
        { t: 16, line: "Bruises on both my knees for you",            next: "Don't say thank you or please" },
        { t: 20, line: "Don't say thank you or please",               next: "I do what I want when I'm wanting to" },
        { t: 24, line: "I'm the bad guy... duh",                      next: "" },
        { t: 28, line: "I like it when you take control",             next: "" },
      ],
    };

    let lyricAudio     = null;
    let lyricPlaying   = false;
    let lyricSelected  = null;
    let lyricInterval  = null;

    // Build song selector buttons
    (function buildLyricSelector() {
      const sel = document.getElementById('lyric-song-selector');
      const available = Object.keys(lyricData);
      available.forEach(title => {
        const btn = document.createElement('button');
        btn.className = 'lyric-song-card';
        btn.textContent = title;
        btn.onclick = () => selectLyricSong(title, btn);
        sel.appendChild(btn);
      });
    })();

    function selectLyricSong(title, btn) {
      stopLyricPlay();
      document.querySelectorAll('.lyric-song-card').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      lyricSelected = title;

      const songObj = songs.find(s => s.title === title);
      document.getElementById('lyric-song-name').textContent = title;
      document.getElementById('lyric-song-artist-name').textContent = songObj ? songObj.artist : '—';
      document.getElementById('lyric-progress-fill').style.width = '0%';

      document.getElementById('lyric-placeholder').style.display = '';
      document.getElementById('lyric-placeholder').textContent = '← Tekan ▶ untuk mulai';
      document.getElementById('lyric-current').style.display = 'none';
      document.getElementById('lyric-next').style.display = 'none';
      document.getElementById('lyric-time-hint').textContent = '00:00';
    }

    function toggleLyricPlay() {
      if (!lyricSelected) {
        document.getElementById('lyric-placeholder').textContent = '← Pilih dulu salah satu lagu';
        return;
      }
      if (lyricPlaying) { stopLyricPlay(); return; }

      const songObj = songs.find(s => s.title === lyricSelected);
      lyricAudio = new Audio(songObj ? songObj.src : '');
      lyricAudio.crossOrigin = 'anonymous';
      lyricPlaying = true;
      document.getElementById('lyric-play-btn').textContent = '⏸';
      document.getElementById('lyric-placeholder').style.display = 'none';
      document.getElementById('lyric-current').style.display = '';
      document.getElementById('lyric-next').style.display = '';

      let lastIdx = -1;
      const lyrics = lyricData[lyricSelected] || [];
      const fmt = t => `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;

      function updateLyric() {
        if (!lyricPlaying) return;
        const cur = lyricAudio.currentTime || 0;
        const dur = lyricAudio.duration || 1;

        document.getElementById('lyric-progress-fill').style.width = (cur / dur * 100) + '%';
        document.getElementById('lyric-time-hint').textContent = fmt(cur);

        let activeIdx = -1;
        for (let i = lyrics.length - 1; i >= 0; i--) {
          if (cur >= lyrics[i].t) { activeIdx = i; break; }
        }

        if (activeIdx !== lastIdx && activeIdx >= 0) {
          lastIdx = activeIdx;
          const cur_el  = document.getElementById('lyric-current');
          const next_el = document.getElementById('lyric-next');
          cur_el.textContent  = lyrics[activeIdx].line;
          next_el.textContent = lyrics[activeIdx].next || '';
          cur_el.classList.remove('lyric-line-anim');
          void cur_el.offsetWidth; // reflow to restart animation
          cur_el.classList.add('lyric-line-anim');
        }
      }

      lyricInterval = setInterval(updateLyric, 100);
      lyricAudio.play().catch(() => {
        document.getElementById('lyric-current').textContent = '♫ [File audio belum tersedia]';
        document.getElementById('lyric-next').textContent    = 'Lirik tetap tampil saat play di atas 0:00';
        // Simulate time-based lyric if no audio file
        let fakeTime = 0;
        clearInterval(lyricInterval);
        lyricInterval = setInterval(() => {
          fakeTime += 0.1;
          document.getElementById('lyric-time-hint').textContent = fmt(fakeTime);
          let activeIdx = -1;
          for (let i = lyrics.length - 1; i >= 0; i--) {
            if (fakeTime >= lyrics[i].t) { activeIdx = i; break; }
          }
          if (activeIdx >= 0 && activeIdx !== lastIdx) {
            lastIdx = activeIdx;
            const cur_el  = document.getElementById('lyric-current');
            const next_el = document.getElementById('lyric-next');
            cur_el.textContent  = lyrics[activeIdx].line;
            next_el.textContent = lyrics[activeIdx].next || '';
            cur_el.classList.remove('lyric-line-anim');
            void cur_el.offsetWidth;
            cur_el.classList.add('lyric-line-anim');
          }
          if (fakeTime >= 35) stopLyricPlay();
        }, 100);
      });

      lyricAudio.addEventListener('ended', stopLyricPlay);
    }

    function stopLyricPlay() {
      lyricPlaying = false;
      clearInterval(lyricInterval);
      if (lyricAudio) { lyricAudio.pause(); lyricAudio = null; }
      document.getElementById('lyric-play-btn').textContent = '▶';
    }

    /* ─────────────────────────────────
       3. LOCAL AUDIO RECORDER
       (dengan LocalStorage persistence)
    ───────────────────────────────── */
    const LS_KEY = 'sonicflow_recordings';

    let recorder       = null;
    let recStream      = null;
    let recChunks      = [];
    let recTimerInt    = null;
    let recSeconds     = 0;
    let recRunning     = false;
    let recAudioCtx2   = null;
    let recAnalyser2   = null;
    let recAnimId2     = null;
    let recIndex       = 0;

    const recCanvas    = document.getElementById('rec-canvas');
    const recCtx2      = recCanvas.getContext('2d');
    const recVizWrap   = document.getElementById('rec-viz-wrap');
    const recBtn       = document.getElementById('rec-btn');
    const recBtnText   = document.getElementById('rec-btn-text');
    const recTimerEl   = document.getElementById('rec-timer');
    const recStatusEl  = document.getElementById('rec-status');
    const recList      = document.getElementById('recordings-list');
    const recEmpty     = document.getElementById('recordings-empty');

    /* ── localStorage helpers ── */
    function lsLoad() {
      try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
      catch { return []; }
    }
    function lsSave(arr) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch(e) {
        recStatusEl.textContent = 'Peringatan: storage penuh, rekaman tidak disimpan permanen.';
      }
    }
    function lsDelete(id) {
      const arr = lsLoad().filter(r => r.id !== id);
      lsSave(arr);
    }

    /* ── Restore recordings on page load ── */
    function restoreRecordings() {
      const saved = lsLoad();
      if (saved.length === 0) return;
      saved.forEach(rec => {
        if (rec.id >= recIndex) recIndex = rec.id; // keep counter consistent
        renderRecordingItem(rec.id, rec.label, rec.timeStr, rec.base64, rec.mimeType, false);
      });
      recEmpty.style.display = 'none';
      recStatusEl.textContent = `${saved.length} rekaman dimuat dari penyimpanan.`;
    }

    /* ── Render a single recording item ── */
    function renderRecordingItem(id, label, timeStr, base64, mimeType, prepend = true) {
      const dataUrl = `data:${mimeType};base64,${base64}`;

      const bars = Array.from({length:18}, (_, i) =>
        `<rect x="${i * 4}" y="0" width="3" height="${4 + Math.random() * 20}" rx="1" fill="rgba(201,168,76,0.5)"/>`
      ).join('');
      const waveformSVG = `<svg class="rec-waveform" viewBox="0 0 72 28" xmlns="http://www.w3.org/2000/svg" style="align-self:center">${bars}</svg>`;

      const item = document.createElement('div');
      item.className = 'recording-item';
      item.dataset.recId = id;
      item.innerHTML = `
        ${waveformSVG}
        <div class="rec-item-label">${label}<small>${timeStr}</small></div>
        <button class="rec-play-btn" title="Putar" onclick="playRecording(this)">▶</button>
        <button class="rec-del-btn" title="Hapus" onclick="deleteRecording(this)">✕</button>
        <audio src="${dataUrl}"></audio>
      `;

      if (prepend) {
        recList.insertBefore(item, recList.firstChild);
      } else {
        recList.appendChild(item);
      }
    }

    function resizeRecCanvas() {
      recCanvas.width  = recCanvas.offsetWidth  * (window.devicePixelRatio || 1);
      recCanvas.height = recCanvas.offsetHeight * (window.devicePixelRatio || 1);
    }
    resizeRecCanvas();
    window.addEventListener('resize', resizeRecCanvas);

    async function toggleRecording() {
      if (recRunning) {
        stopRecording();
      } else {
        await startRecording();
      }
    }

    async function startRecording() {
      try {
        recStatusEl.textContent = 'Meminta izin mikrofon...';
        recStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        recAudioCtx2 = new (window.AudioContext || window.webkitAudioContext)();
        recAnalyser2 = recAudioCtx2.createAnalyser();
        recAnalyser2.fftSize = 128;
        recAnalyser2.smoothingTimeConstant = 0.8;
        const recSrc = recAudioCtx2.createMediaStreamSource(recStream);
        recSrc.connect(recAnalyser2);

        const mimeType = ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/webm','audio/ogg']
          .find(m => MediaRecorder.isTypeSupported(m)) || '';
        recorder   = new MediaRecorder(recStream, mimeType ? { mimeType } : {});
        recChunks  = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
        recorder.onstop = saveRecording;
        recorder.start(200);

        recRunning = true;
        recSeconds = 0;
        recBtn.classList.add('recording-active');
        recVizWrap.classList.add('recording');
        recBtnText.textContent = 'Stop Rekaman';
        recStatusEl.textContent = 'Sedang merekam...';

        recTimerInt = setInterval(() => {
          recSeconds++;
          const m = Math.floor(recSeconds / 60);
          const s = recSeconds % 60;
          recTimerEl.textContent = `${m}:${String(s).padStart(2,'0')} / 0:30`;
          if (recSeconds >= 30) stopRecording();
        }, 1000);

        drawRecVisualizer();
      } catch(e) {
        recStatusEl.textContent = 'Izin mikrofon ditolak.';
      }
    }

    function stopRecording() {
      recRunning = false;
      clearInterval(recTimerInt);
      if (recAnimId2) cancelAnimationFrame(recAnimId2);
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      if (recStream) recStream.getTracks().forEach(t => t.stop());
      if (recAudioCtx2) recAudioCtx2.close();
      recAudioCtx2 = null; recAnalyser2 = null;

      recCtx2.clearRect(0, 0, recCanvas.width, recCanvas.height);
      recVizWrap.classList.remove('recording');
      recBtn.classList.remove('recording-active');
      recBtnText.textContent = 'Mulai Rekam';
      recStatusEl.textContent = 'Rekaman selesai — sedang memproses...';
    }

    function saveRecording() {
      if (recChunks.length === 0) { recStatusEl.textContent = 'Tidak ada data terekam.'; return; }

      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(recChunks, { type: mimeType });

      // Convert blob → base64 for localStorage
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1]; // strip data URL prefix

        recIndex++;
        const id      = recIndex;
        const dur     = recSeconds;
        const label   = `Rekaman #${id}`;
        const timeStr = `${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')} — ${new Date().toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})}`;

        // Persist to localStorage
        const arr = lsLoad();
        arr.push({ id, label, timeStr, base64, mimeType });
        lsSave(arr);

        // Render in UI
        recEmpty.style.display = 'none';
        renderRecordingItem(id, label, timeStr, base64, mimeType, true);
        recStatusEl.textContent = `Rekaman #${id} tersimpan — dengarkan di bawah!`;
        recTimerEl.textContent  = '0:00 / 0:30';
      };
      reader.readAsDataURL(blob);
    }

    function playRecording(btn) {
      document.querySelectorAll('.recording-item audio').forEach(a => {
        if (!a.paused) { a.pause(); a.currentTime = 0; }
      });
      document.querySelectorAll('.rec-play-btn').forEach(b => b.textContent = '▶');

      const item  = btn.closest('.recording-item');
      const audio = item.querySelector('audio');

      if (audio.paused) {
        audio.play();
        btn.textContent = '⏸';
        audio.onended = () => { btn.textContent = '▶'; };
      } else {
        audio.pause();
        btn.textContent = '▶';
      }
    }

    function deleteRecording(btn) {
      const item  = btn.closest('.recording-item');
      const id    = Number(item.dataset.recId);
      const audio = item.querySelector('audio');
      if (audio) audio.pause();

      // Remove from localStorage
      lsDelete(id);

      item.style.animation = 'none';
      item.style.transition = 'opacity 0.3s, transform 0.3s';
      item.style.opacity    = '0';
      item.style.transform  = 'translateX(20px)';
      setTimeout(() => {
        item.remove();
        if (document.querySelectorAll('.recording-item').length === 0) {
          recEmpty.style.display = '';
        }
      }, 320);
    }

    // Load saved recordings when page is ready
    restoreRecordings();

    function drawRecVisualizer() {
      if (!recRunning || !recAnalyser2) return;
      recAnimId2 = requestAnimationFrame(drawRecVisualizer);

      const W = recCanvas.offsetWidth;
      const H = recCanvas.offsetHeight;
      const bufLen = recAnalyser2.frequencyBinCount;
      const data   = new Uint8Array(bufLen);
      recAnalyser2.getByteFrequencyData(data);

      recCtx2.clearRect(0, 0, recCanvas.width, recCanvas.height);
      const barCount = 40;
      const barW = (W - 2 * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const idx  = Math.floor(i / barCount * bufLen);
        const val  = data[idx] / 255;
        const barH = Math.max(3, val * H * 0.88);
        const x    = i * (barW + 2);
        const y    = (H - barH) / 2;

        // Red-to-gold palette for recording
        const r = Math.round(180 + val * 52);
        const g = Math.round(74  + val * 94);
        const b = Math.round(74  + val * 2);
        recCtx2.fillStyle = `rgba(${r},${g},${b},${0.55 + val * 0.45})`;
        recCtx2.beginPath();
        recCtx2.roundRect(x, y, barW, barH, Math.min(barW / 2, 3));
        recCtx2.fill();
      }
    }

    /* ════════════════════════════════
       SCROLL REVEAL (Intersection Observer)
    ════════════════════════════════ */
    const revealEls = document.querySelectorAll('.mood-card, .squad-card, .info-col');
    revealEls.forEach((el, i) => {
      el.style.opacity   = '0';
      el.style.transform = 'translateY(28px)';
      el.style.transition = `opacity 0.6s ${i * 0.07}s ease, transform 0.6s ${i * 0.07}s ease`;
    });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.opacity   = '1';
          e.target.style.transform = 'translateY(0)';
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach(el => observer.observe(el));

    /* ════════════════════════════════
       MICRO-INTERACTIONS
       Navbar scroll · Section reveal · Active link · Progress bar
    ════════════════════════════════ */
    const scrollProgressBar = document.createElement('div');
    scrollProgressBar.id = 'scroll-progress';
    document.body.prepend(scrollProgressBar);

    document.querySelectorAll('section').forEach(sec => sec.classList.add('section-fade-in'));

    const mainNav     = document.getElementById('main-nav');
    const navAnchors  = document.querySelectorAll('#nav-links a[href^="#"]');
    const allSections = document.querySelectorAll('section[id]');

    function handleScroll() {
      const scrollY  = window.scrollY;
      const docH     = document.documentElement.scrollHeight - window.innerHeight;
      scrollProgressBar.style.width = (docH > 0 ? scrollY / docH * 100 : 0) + '%';

      if (scrollY > 60) mainNav.classList.add('scrolled');
      else              mainNav.classList.remove('scrolled');

      let current = '';
      allSections.forEach(sec => { if (scrollY >= sec.offsetTop - 120) current = sec.id; });
      navAnchors.forEach(a => {
        a.classList.toggle('nav-active', a.getAttribute('href') === '#' + current);
      });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('revealed'); sectionObserver.unobserve(e.target); }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.section-fade-in').forEach(sec => sectionObserver.observe(sec));

/* ═══════════════════════════════════════════════
   LOADING SCREEN  — isolated, tidak ganggu auth
═══════════════════════════════════════════════ */
(function () {
  const loader  = document.getElementById('sf-loader');
  const bar     = document.getElementById('sf-loader-bar');
  const txt     = document.getElementById('sf-loader-text');
  if (!loader) return;

  // Kunci scroll hanya via loader flag, bukan body.overflow langsung
  // supaya tidak bentrok dengan openAuthModal()
  loader.style.overflow = 'hidden';

  const steps = [
    { pct: 18,  msg: 'Menginisialisasi musik...' },
    { pct: 42,  msg: 'Memuat komponen...' },
    { pct: 68,  msg: 'Menghubungkan ke server...' },
    { pct: 88,  msg: 'Hampir selesai...' },
    { pct: 100, msg: 'Selamat datang!' },
  ];

  let i = 0;
  const tick = setInterval(() => {
    if (i >= steps.length) { clearInterval(tick); return; }
    const s = steps[i++];
    if (bar) bar.style.width = s.pct + '%';
    if (txt) txt.textContent = s.msg;
    if (s.pct === 100) {
      clearInterval(tick);
      setTimeout(() => {
        loader.classList.add('sf-hidden');
        // Hanya unlock scroll kalau TIDAK ada modal yang sedang buka
        const modalOpen = document.getElementById('auth-modal')?.classList.contains('visible');
        if (!modalOpen) document.body.style.overflow = '';
      }, 500);
    }
  }, 390);

  // Blokir scroll lewat body selama loading
  document.body.style.overflow = 'hidden';
})();

/* ═══════════════════════════════════════════════
   THEME TOGGLE — Light / Dark
═══════════════════════════════════════════════ */
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light-mode');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = isLight ? '☀️' : '🌙';
  try { localStorage.setItem('sf-theme', isLight ? 'light' : 'dark'); } catch(e) {}
}

// Restore theme on load (sebelum paint untuk hindari flicker)
(function () {
  try {
    if (localStorage.getItem('sf-theme') === 'light') {
      document.documentElement.classList.add('light-mode');
      // Icon akan diset setelah DOM siap
      document.addEventListener('DOMContentLoaded', () => {
        const icon = document.getElementById('theme-icon');
        if (icon) icon.textContent = '☀️';
      });
    }
  } catch(e) {}
})();
