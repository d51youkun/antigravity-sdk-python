import "./style.css";
import JSZip from "jszip";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const state = {
  sessionId: null,
  teams: [],
  loggedIn: false,
  appleId: "",
  ipaFile: null,
  bundleId: "",
  appName: "",
  appIconUrl: null,
  activeTab: "today",
  signedFilename: null,
};

let signedBlobUrl = null;

/* ── Data (iOSGods App+ inspired) ── */

const FEATURES = [
  {
    icon: "📲",
    color: "#007AFF",
    title: "端末内インストール",
    desc: "PC不要。iPad / iPhone の Safari だけで IPA を署名・取得できます。",
  },
  {
    icon: "✍️",
    color: "#5856D6",
    title: "独自 IPA を署名",
    desc: "お手持ちの .ipa をアップロード。無料 Apple ID で開発証明書を自動取得します。",
  },
  {
    icon: "🔒",
    color: "#34C759",
    title: "ブラウザ内署名",
    desc: "IPA は端末内で処理。署名ファイルをサーバーにアップロードしません。",
  },
  {
    icon: "⚡",
    color: "#FF9500",
    title: "ワンタップ開始",
    desc: "Apple ID ログイン → UDID 登録 → 署名 → ダウンロードまで一本化。",
  },
];

const FAQ = [
  {
    q: "PCは必要ですか？",
    a: "不要です。iPad / iPhone の Safari からすべて完結します。署名後の IPA は「ファイル」アプリに保存し、AltStore 等でインストールできます。",
  },
  {
    q: "無料 Apple ID で使えますか？",
    a: "はい。有料の Apple Developer Program なしで、個人用の無料開発者証明書を取得して署名できます。",
  },
  {
    q: "署名の有効期限は？",
    a: "無料 Apple ID の場合、約7日間です。期限切れ後は同じ手順で再署名してください。",
  },
  {
    q: "UDID とは？",
    a: "インストール先デバイスの固有 ID です。Apple の開発者ポータルに登録し、プロビジョニングプロファイルを作成するために必要です。",
  },
  {
    q: "Developer Mode は必要？",
    a: "iOS 16 以降、サイドロードしたアプリを使うには 設定 → プライバシーとセキュリティ → デベロッパモード を ON にしてください。",
  },
];

/* ── DOM bootstrap ── */

const app = document.getElementById("app");

app.innerHTML = `
  <header class="top-nav">
    <div class="top-nav-inner">
      <h1 id="nav-title">Today</h1>
      <button type="button" class="account-chip logged-out" id="account-chip" aria-label="アカウント">
        <span class="avatar" id="account-avatar">👤</span>
        <span id="account-label">サインイン</span>
      </button>
    </div>
  </header>

  <main class="screen-scroll">
    <!-- Today -->
    <section class="screen active" id="screen-today" data-title="Today">
      <div class="hero-banner">
        <div class="hero-eyebrow">On-Device · No Computer</div>
        <h2>Sign Your Own IPA</h2>
        <p>
          iOSGods App+ のように、iPad だけで IPA を署名。
          無料 Apple ID で開発証明書を取得し、ブラウザ内で完結します。
        </p>
        <button type="button" class="hero-cta" id="hero-cta">はじめる</button>
      </div>

      <div class="section-head">
        <h3>機能</h3>
        <span>App+ 風</span>
      </div>
      <div class="feature-scroll" id="feature-scroll"></div>

      <div class="section-head">
        <h3>使い方</h3>
      </div>
      <div class="grouped-list" id="howto-list"></div>

      <div class="section-head">
        <h3>よくある質問</h3>
      </div>
      <div class="faq-list" id="faq-list"></div>
      <p class="list-footnote" style="padding-bottom:24px">
        無料 Apple ID: 署名約7日 / App ID 週10件 / 同時サイドロード数に制限あり
      </p>
    </section>

    <!-- Sign (App Store product page) -->
    <section class="screen" id="screen-sign" data-title="Sign">
      <div class="app-detail">
        <div class="app-header">
          <div class="app-icon" id="app-icon">
            <span class="placeholder">📦</span>
          </div>
          <div class="app-meta">
            <h2 id="app-name">IPA を選択</h2>
            <p class="subtitle" id="app-subtitle">ファイルアプリから .ipa を選んでください</p>
            <button type="button" class="get-button" id="pick-ipa-btn">選択</button>
            <p class="in-app-purchase">無料 · Apple ID ログイン必要</p>
          </div>
        </div>

        <div id="sign-status" class="status-banner hidden"></div>

        <div class="form-group">
          <label for="udid">デバイス UDID</label>
          <input id="udid" type="text" inputmode="text" autocapitalize="off"
            placeholder="00008030-001234567890001E" autocomplete="off" />
        </div>

        <div class="form-group hidden" id="team-group">
          <label for="team-id">開発チーム</label>
          <select id="team-id"></select>
        </div>

        <div class="form-group">
          <button type="button" class="get-button primary-action" id="sign-btn" disabled>
            署名してダウンロード
          </button>
        </div>

        <div class="section-head" style="padding-left:0;padding-right:0">
          <h3>アプリ情報</h3>
        </div>
        <div class="grouped-list">
          <div class="list-row"><span class="label">Bundle ID</span><span id="info-bundle" style="color:var(--label-secondary);font-size:15px">—</span></div>
          <div class="list-row"><span class="label">ファイル</span><span id="info-file" style="color:var(--label-secondary);font-size:15px">—</span></div>
          <div class="list-row"><span class="label">サイズ</span><span id="info-size" style="color:var(--label-secondary);font-size:15px">—</span></div>
        </div>
        <p class="list-footnote">
          署名は端末内で実行。証明書取得のみサーバーと通信します。
        </p>
      </div>
    </section>

    <!-- Library (signed history placeholder) -->
    <section class="screen" id="screen-library" data-title="Library">
      <div class="section-head"><h3>ライブラリ</h3></div>
      <div class="grouped-list">
        <div class="list-row">
          <span class="icon-wrap" style="background:#007AFF;color:#fff">⬇️</span>
          <span class="label">署名済み IPA</span>
          <span class="chevron">›</span>
        </div>
      </div>
      <p class="list-footnote" id="library-empty">
        署名が完了すると、ここから再ダウンロードできます（このセッション内）。
      </p>
      <div class="form-group hidden" id="library-download-wrap">
        <button type="button" class="get-button primary-action" id="library-download-btn">
          署名済み IPA をダウンロード
        </button>
      </div>
    </section>

    <!-- Search / Account -->
    <section class="screen" id="screen-account" data-title="Account">
      <div class="section-head"><h3>Apple ID</h3></div>
      <div class="grouped-list">
        <div class="list-row" id="account-status-row">
          <span class="icon-wrap" style="background:#FF9500;color:#fff"></span>
          <span class="label" id="account-status-text">未サインイン</span>
        </div>
      </div>
      <div class="form-group" style="margin-top:20px">
        <button type="button" class="get-button primary-action" id="account-action-btn">
          サインイン
        </button>
      </div>
      <div class="section-head"><h3>デバイス</h3></div>
      <div class="grouped-list">
        <div class="list-row">
          <span class="icon-wrap" style="background:#5856D6;color:#fff">📱</span>
          <span class="label">Developer Mode</span>
          <span style="color:var(--label-secondary);font-size:15px">要確認</span>
        </div>
        <div class="list-row">
          <span class="icon-wrap" style="background:#34C759;color:#fff">✓</span>
          <span class="label">証明書の信頼</span>
          <span style="color:var(--label-secondary);font-size:15px">設定で実施</span>
        </div>
      </div>
      <p class="list-footnote">
        設定 → 一般 → VPNとデバイス管理 → 自分の Apple ID を信頼
      </p>
    </section>
  </main>

  <nav class="tab-bar" aria-label="メイン">
    <button type="button" class="tab-item active" data-tab="today">
      <span class="tab-icon">📰</span><span>Today</span>
    </button>
    <button type="button" class="tab-item" data-tab="sign">
      <span class="tab-icon">✍️</span><span>Sign</span>
    </button>
    <button type="button" class="tab-item" data-tab="library">
      <span class="tab-icon">⬇️</span><span>Library</span>
    </button>
    <button type="button" class="tab-item" data-tab="account">
      <span class="tab-icon">👤</span><span>Account</span>
    </button>
  </nav>

  <input type="file" id="ipa-input" accept=".ipa,application/octet-stream" hidden />

  <!-- Sheet: Login / 2FA -->
  <div class="sheet-backdrop" id="sheet-backdrop"></div>
  <div class="sheet" id="sheet" role="dialog" aria-modal="true">
    <div class="sheet-grabber"></div>
    <header class="sheet-header">
      <button type="button" class="sheet-close" id="sheet-close">閉じる</button>
      <h3 id="sheet-title">サインイン</h3>
      <span style="width:52px"></span>
    </header>
    <div class="sheet-body" id="sheet-body"></div>
  </div>
`;

/* ── Element refs ── */

const $ = (sel) => document.querySelector(sel);

const els = {
  navTitle: $("#nav-title"),
  accountChip: $("#account-chip"),
  accountAvatar: $("#account-avatar"),
  accountLabel: $("#account-label"),
  heroCta: $("#hero-cta"),
  featureScroll: $("#feature-scroll"),
  howtoList: $("#howto-list"),
  faqList: $("#faq-list"),
  appIcon: $("#app-icon"),
  appName: $("#app-name"),
  appSubtitle: $("#app-subtitle"),
  pickIpaBtn: $("#pick-ipa-btn"),
  ipaInput: $("#ipa-input"),
  udid: $("#udid"),
  teamGroup: $("#team-group"),
  teamId: $("#team-id"),
  signBtn: $("#sign-btn"),
  signStatus: $("#sign-status"),
  infoBundle: $("#info-bundle"),
  infoFile: $("#info-file"),
  infoSize: $("#info-size"),
  libraryEmpty: $("#library-empty"),
  libraryWrap: $("#library-download-wrap"),
  libraryDownloadBtn: $("#library-download-btn"),
  accountStatusText: $("#account-status-text"),
  accountActionBtn: $("#account-action-btn"),
  sheetBackdrop: $("#sheet-backdrop"),
  sheet: $("#sheet"),
  sheetTitle: $("#sheet-title"),
  sheetBody: $("#sheet-body"),
  sheetClose: $("#sheet-close"),
};

/* ── Render static content ── */

function renderFeatures() {
  els.featureScroll.innerHTML = FEATURES.map(
    (f) => `
    <article class="feature-card">
      <div class="feature-icon" style="background:${f.color}20;color:${f.color}">${f.icon}</div>
      <h4>${f.title}</h4>
      <p>${f.desc}</p>
    </article>`,
  ).join("");
}

function renderHowTo() {
  const steps = [
    { icon: "1", bg: "#007AFF", label: "Apple ID でサインイン" },
    { icon: "2", bg: "#5856D6", label: "UDID を登録" },
    { icon: "3", bg: "#FF9500", label: "IPA を選択" },
    { icon: "4", bg: "#34C759", label: "署名してダウンロード" },
  ];
  els.howtoList.innerHTML = steps
    .map(
      (s) => `
    <div class="list-row">
      <span class="icon-wrap" style="background:${s.bg};color:#fff;font-size:13px;font-weight:700">${s.icon}</span>
      <span class="label">${s.label}</span>
    </div>`,
    )
    .join("");
}

function renderFaq() {
  els.faqList.innerHTML = FAQ.map(
    (item, i) => `
    <div class="faq-item" data-i="${i}">
      <button type="button" class="faq-q">${item.q}<span class="plus">+</span></button>
      <div class="faq-a">${item.a}</div>
    </div>`,
  ).join("");

  els.faqList.querySelectorAll(".faq-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".faq-item").classList.toggle("open");
    });
  });
}

renderFeatures();
renderHowTo();
renderFaq();

/* ── Navigation ── */

const TAB_TITLES = {
  today: "Today",
  sign: "Sign",
  library: "Library",
  account: "Account",
};

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab-item").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.toggle("active", s.id === `screen-${tab}`);
  });
  els.navTitle.textContent = TAB_TITLES[tab] || tab;
}

document.querySelectorAll(".tab-item").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

/* ── Account UI ── */

function updateAccountUI() {
  if (state.loggedIn) {
    els.accountChip.classList.remove("logged-out");
    els.accountAvatar.textContent = state.appleId.charAt(0).toUpperCase();
    els.accountLabel.textContent = state.appleId.split("@")[0];
    els.accountStatusText.textContent = state.appleId;
    els.accountActionBtn.textContent = "サインアウト";
    els.teamGroup.classList.remove("hidden");
  } else {
    els.accountChip.classList.add("logged-out");
    els.accountAvatar.textContent = "👤";
    els.accountLabel.textContent = "サインイン";
    els.accountStatusText.textContent = "未サインイン";
    els.accountActionBtn.textContent = "サインイン";
    els.teamGroup.classList.add("hidden");
  }
}

function signOut() {
  state.sessionId = null;
  state.teams = [];
  state.loggedIn = false;
  state.appleId = "";
  updateAccountUI();
}

/* ── Sheet modal ── */

function openSheet(title, html) {
  els.sheetTitle.textContent = title;
  els.sheetBody.innerHTML = html;
  els.sheetBackdrop.classList.add("open");
  els.sheet.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSheet() {
  els.sheetBackdrop.classList.remove("open");
  els.sheet.classList.remove("open");
  document.body.style.overflow = "";
}

els.sheetClose.addEventListener("click", closeSheet);
els.sheetBackdrop.addEventListener("click", closeSheet);

function openLoginSheet(step = "login") {
  if (step === "login") {
    openSheet(
      "Apple ID",
      `
      <p style="margin:0 0 16px;color:var(--label-secondary);font-size:15px;line-height:1.5">
        iOSGods と同様、サインインしてデバイスを登録し、証明書を取得します。
        パスワードは SRP で Apple に直接送信され、平文保存はしません。
      </p>
      <div class="progress-steps">
        <div class="progress-dot active"></div>
        <div class="progress-dot"></div>
        <div class="progress-dot"></div>
      </div>
      <div class="form-group">
        <label for="sheet-apple-id">Apple ID</label>
        <input id="sheet-apple-id" type="email" autocomplete="username" placeholder="name@example.com" />
      </div>
      <div class="form-group">
        <label for="sheet-password">パスワード</label>
        <input id="sheet-password" type="password" autocomplete="current-password" />
      </div>
      <div id="sheet-status" class="status-banner hidden"></div>
      <div class="sheet-actions">
        <button type="button" class="get-button primary-action" id="sheet-login-btn">続ける</button>
      </div>
    `,
    );

    $("#sheet-login-btn").addEventListener("click", handleLogin);
    return;
  }

  if (step === "2fa") {
    openSheet(
      "二要素認証",
      `
      <p style="margin:0 0 16px;color:var(--label-secondary);font-size:15px;line-height:1.5" id="tfa-desc">
        信頼済みデバイスまたは SMS に届いたコードを入力してください。
      </p>
      <div class="progress-steps">
        <div class="progress-dot done"></div>
        <div class="progress-dot active"></div>
        <div class="progress-dot"></div>
      </div>
      <div class="form-group">
        <label for="sheet-tfa">認証コード</label>
        <input id="sheet-tfa" type="text" inputmode="numeric" maxlength="8" placeholder="123456" />
      </div>
      <div id="sheet-status" class="status-banner hidden"></div>
      <div class="sheet-actions">
        <button type="button" class="get-button primary-action" id="sheet-tfa-btn">確認</button>
      </div>
    `,
    );
    $("#sheet-tfa-btn").addEventListener("click", handle2FA);
  }
}

function sheetStatus(msg, kind = "info") {
  const el = $("#sheet-status");
  if (!el) return;
  el.textContent = msg;
  el.className = `status-banner ${kind}`;
  el.classList.remove("hidden");
}

function requireLogin(thenTab = "sign") {
  if (state.loggedIn) {
    switchTab(thenTab);
    return;
  }
  openLoginSheet("login");
}

els.heroCta.addEventListener("click", () => requireLogin("sign"));
els.accountChip.addEventListener("click", () => switchTab("account"));
els.accountActionBtn.addEventListener("click", () => {
  if (state.loggedIn) signOut();
  else openLoginSheet("login");
});

/* ── API ── */

async function api(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  return data;
}

async function handleLogin() {
  const btn = $("#sheet-login-btn");
  const appleId = $("#sheet-apple-id").value.trim();
  const password = $("#sheet-password").value;
  if (!appleId || !password) {
    sheetStatus("Apple ID とパスワードを入力してください", "error");
    return;
  }

  btn.disabled = true;
  btn.classList.add("loading");
  try {
    const result = await api("/api/auth/login", { apple_id: appleId, password });
    state.sessionId = result.session_id;
    state.appleId = appleId;

    if (result.needs_2fa) {
      state.tfaType = result.tfa_type;
      openLoginSheet("2fa");
      if (result.tfa_type === "sms") {
        const desc = $("#tfa-desc");
        if (desc) desc.textContent = "SMS に届いた6桁コードを入力してください。";
      }
      return;
    }

    finishLogin(result.teams || []);
  } catch (e) {
    sheetStatus(e.message, "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
  }
}

async function handle2FA() {
  const btn = $("#sheet-tfa-btn");
  const code = $("#sheet-tfa").value.trim();
  if (!code) {
    sheetStatus("認証コードを入力してください", "error");
    return;
  }

  btn.disabled = true;
  try {
    const result = await api("/api/auth/2fa", { session_id: state.sessionId, code });
    finishLogin(result.teams || []);
  } catch (e) {
    sheetStatus(e.message, "error");
  } finally {
    btn.disabled = false;
  }
}

function finishLogin(teams) {
  state.teams = teams;
  state.loggedIn = true;
  populateTeams(teams);
  updateAccountUI();
  closeSheet();
  switchTab("sign");
  showSignStatus("サインイン完了。IPA を選択して署名できます。", "ok");
}

function populateTeams(teams) {
  els.teamId.innerHTML = teams
    .map((t) => `<option value="${t.team_id}">${t.name} (${t.team_id})</option>`)
    .join("");
}

/* ── IPA handling ── */

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function extractAppIcon(zip, infoPath) {
  try {
    const appDir = infoPath.replace("/Info.plist", "/");
    const plistText = await zip.file(infoPath).async("string");
    const iconMatch = plistText.match(/<key>CFBundleIcons[^]*?<key>CFBundlePrimaryIcon[^]*?<key>CFBundleIconFiles[^]*?<array>\s*<string>([^<]+)<\/string>/);
    const iconBase = iconMatch?.[1];
    if (!iconBase) return null;

    const candidates = [
      `${appDir}${iconBase}@3x.png`,
      `${appDir}${iconBase}@2x.png`,
      `${appDir}${iconBase}.png`,
      `${appDir}${iconBase}@3x.jpg`,
      `${appDir}${iconBase}.jpg`,
    ];
    for (const path of candidates) {
      const file = zip.file(path);
      if (file) {
        const blob = await file.async("blob");
        return URL.createObjectURL(blob);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function parseIpaMetadata(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const infoPath = Object.keys(zip.files).find(
    (n) => n.endsWith("/Info.plist") && n.startsWith("Payload/") && n.split("/").length === 3,
  );
  if (!infoPath) throw new Error("IPA 内に Info.plist が見つかりません");

  const text = await zip.file(infoPath).async("string");
  const bundleMatch = text.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/);
  const nameMatch =
    text.match(/<key>CFBundleDisplayName<\/key>\s*<string>([^<]+)<\/string>/) ||
    text.match(/<key>CFBundleName<\/key>\s*<string>([^<]+)<\/string>/);

  if (!bundleMatch) throw new Error("Bundle ID を読み取れませんでした");

  const iconUrl = await extractAppIcon(zip, infoPath);

  return {
    bundleId: bundleMatch[1],
    appName: nameMatch?.[1] || bundleMatch[1].split(".").pop(),
    iconUrl,
  };
}

function updateAppDetailUI() {
  if (state.appIconUrl) {
    els.appIcon.innerHTML = `<img src="${state.appIconUrl}" alt="" />`;
  } else {
    els.appIcon.innerHTML = `<span class="placeholder">📦</span>`;
  }

  if (state.ipaFile) {
    els.appName.textContent = state.appName || "選択済み IPA";
    els.appSubtitle.textContent = state.bundleId;
    els.pickIpaBtn.textContent = "変更";
    els.infoBundle.textContent = state.bundleId || "—";
    els.infoFile.textContent = state.ipaFile.name;
    els.infoSize.textContent = formatBytes(state.ipaFile.size);
    els.signBtn.disabled = !state.loggedIn;
  } else {
    els.appName.textContent = "IPA を選択";
    els.appSubtitle.textContent = "ファイルアプリから .ipa を選んでください";
    els.pickIpaBtn.textContent = "選択";
    els.signBtn.disabled = true;
  }
}

function showSignStatus(msg, kind = "info") {
  els.signStatus.textContent = msg;
  els.signStatus.className = `status-banner ${kind}`;
  els.signStatus.classList.remove("hidden");
}

els.pickIpaBtn.addEventListener("click", () => els.ipaInput.click());

els.ipaInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (state.appIconUrl) URL.revokeObjectURL(state.appIconUrl);

  showSignStatus("IPA を解析中...", "info");
  try {
    const meta = await parseIpaMetadata(file);
    state.ipaFile = file;
    state.bundleId = meta.bundleId;
    state.appName = meta.appName;
    state.appIconUrl = meta.iconUrl;
    updateAppDetailUI();
    els.signStatus.classList.add("hidden");
    if (!state.loggedIn) {
      showSignStatus("署名するには Apple ID でサインインしてください。", "info");
    }
  } catch (err) {
    showSignStatus(err.message, "error");
  }
});

/* ── Signing ── */

async function signInBrowser(ipaFile, credentials) {
  const { createResigner } = await import("zsign-wasm");
  const resigner = await createResigner();
  const ipaBytes = new Uint8Array(await ipaFile.arrayBuffer());
  const p12Bytes = Uint8Array.from(atob(credentials.p12_base64), (c) => c.charCodeAt(0));
  const profileBytes = Uint8Array.from(atob(credentials.profile_base64), (c) => c.charCodeAt(0));

  const result = await resigner.signIpa(ipaBytes, {
    pkey: p12Bytes,
    prov: profileBytes,
    password: credentials.p12_password || "",
    bundleId: credentials.bundle_id,
    adhoc: false,
    forceSign: true,
  });
  return result.data || result;
}

els.signBtn.addEventListener("click", async () => {
  if (state.signedFilename && signedBlobUrl) {
    const a = document.createElement("a");
    a.href = signedBlobUrl;
    a.download = state.signedFilename;
    a.click();
    return;
  }

  if (!state.loggedIn) {
    openLoginSheet("login");
    return;
  }
  if (!state.ipaFile || !state.bundleId) {
    showSignStatus("IPA を選択してください", "error");
    return;
  }
  const udid = els.udid.value.trim();
  if (!udid) {
    showSignStatus("UDID を入力してください", "error");
    return;
  }

  els.signBtn.disabled = true;
  els.signBtn.classList.add("loading");
  els.signBtn.textContent = "処理中...";

  if (signedBlobUrl) {
    URL.revokeObjectURL(signedBlobUrl);
    signedBlobUrl = null;
  }
  state.signedFilename = null;

  try {
    showSignStatus("証明書を取得しています...", "info");

    const credentials = await api("/api/provision", {
      session_id: state.sessionId,
      udid,
      bundle_id: state.bundleId,
      app_name: state.appName,
      team_id: els.teamId.value || undefined,
    });

    showSignStatus("端末内で IPA を署名しています...", "info");

    const signedBytes = await signInBrowser(state.ipaFile, credentials);
    const blob = new Blob([signedBytes], { type: "application/octet-stream" });
    signedBlobUrl = URL.createObjectURL(blob);
    state.signedFilename = state.ipaFile.name.replace(/\.ipa$/i, "") + "_signed.ipa";

    const download = () => {
      const a = document.createElement("a");
      a.href = signedBlobUrl;
      a.download = state.signedFilename;
      a.click();
    };

    els.libraryWrap.classList.remove("hidden");
    els.libraryEmpty.textContent = `${state.signedFilename} — タップで再ダウンロード`;
    els.libraryDownloadBtn.onclick = download;

    els.signBtn.textContent = "ダウンロード";

    showSignStatus(
      `署名完了\n${credentials.bundle_id}\n「ダウンロード」でファイル App に保存してください。`,
      "ok",
    );

    switchTab("library");
  } catch (e) {
    showSignStatus(e.message, "error");
    els.signBtn.textContent = "署名してダウンロード";
  } finally {
    els.signBtn.classList.remove("loading");
    els.signBtn.disabled = false;
  }
});

updateAccountUI();
updateAppDetailUI();
