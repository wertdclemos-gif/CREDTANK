



      const formatBRL = (value) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

      const formatCurrencyInput = (value) => {
        const digits = String(value || "").replace(/\D/g, "");
        if (!digits) return "";
        const padded = digits.padStart(3, "0");
        const cents = padded.slice(-2);
        const integer = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
        const intFormatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return `${intFormatted || "0"},${cents}`;
      };

      const parseCurrencyInput = (value) => {
        const normalized = String(value || "")
          .replace(/\./g, "")
          .replace(",", ".")
          .replace(/[^\d.]/g, "");
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const demoParam = new URLSearchParams(window.location.search).get("demo");
      const demoValue = String(demoParam || "").toLowerCase();
      const isLocalHost =
        window.location.protocol === "file:" ||
        ["localhost", "127.0.0.1"].includes(window.location.hostname);
      const DEMO_MODE = false;
      const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
      const normalizeCpfDigits = (value) => String(value || "").replace(/\D/g, "");
      const upsertByPredicate = (list, predicate, item) => {
        const safeList = Array.isArray(list) ? list : [];
        const index = safeList.findIndex(predicate);
        if (index >= 0) {
          const current = safeList[index] || {};
          safeList[index] = { ...current, ...item, id: current.id || item.id };
        } else {
          safeList.push({ ...item });
        }
      };
      const upsertById = (list, item) =>
        upsertByPredicate(list, (entry) => String(entry?.id || "") === String(item.id || ""), item);
      const upsertUser = (list, user) => {
        const email = normalizeEmail(user.email);
        upsertByPredicate(
          list,
          (entry) =>
            String(entry?.id || "") === String(user.id || "") || normalizeEmail(entry?.email) === email,
          user
        );
      };
      const upsertColaboradorAuth = (list, auth) => {
        const cpf = normalizeCpfDigits(auth.cpf);
        upsertByPredicate(
          list,
          (entry) =>
            String(entry?.id || "") === String(auth.id || "") ||
            String(entry?.funcionarioId || "") === String(auth.funcionarioId || "") ||
            normalizeCpfDigits(entry?.cpf) === cpf,
          auth
        );
      };
      const ensureLocalTestFixtures = (snapshot) => snapshot && typeof snapshot === "object" ? { ...snapshot } : {};
      const applyLocalFixturesToState = () => {};

      const state = {
        limitePadrao: 500,
        validadeMs: 90 * 1000,
        qrInstance: null,
        scanner: {
          active: false,
          stream: null,
          rafId: null,
          lastValue: "",
          cooldownUntil: 0,
        },
        empresas: [],
        postos: [],
        funcionarios: [],
        usuarios: [],
        colaboradoresAuth: [],
        transacoes: [],
        logs: [],
        usedTokens: new Set(),
        currentToken: null,
        timerId: null,
        reportData: {
          extrato: [],
          empresa: [],
          repasse: [],
        folha: [],
        periodo: "",
        empresaNome: "",
        empresaCnpj: "",
        funcionarioNome: "",
        funcionarioCpf: "",
        extratoEmpresaNome: "",
        extratoEmpresaCnpj: "",
        folhaTotal: 0,
        folhaColaboradores: 0,
      },
      };

      if (!DEMO_MODE) {
        state.empresas = [];
        state.postos = [];
        state.funcionarios = [];
        state.usuarios = [];
        state.colaboradoresAuth = [];
      }
      applyLocalFixturesToState();

      const DEFAULT_STATE = JSON.parse(
        JSON.stringify({
          limitePadrao: state.limitePadrao,
          validadeMs: state.validadeMs,
          empresas: state.empresas,
          postos: state.postos,
          funcionarios: state.funcionarios,
          usuarios: state.usuarios,
          colaboradoresAuth: state.colaboradoresAuth,
          transacoes: state.transacoes,
          logs: state.logs,
        })
      );

      const REPORT_DATA_DEFAULT = {
        extrato: [],
        empresa: [],
        repasse: [],
        folha: [],
        periodo: "",
        empresaNome: "",
        empresaCnpj: "",
        funcionarioNome: "",
        funcionarioCpf: "",
        extratoEmpresaNome: "",
        extratoEmpresaCnpj: "",
        folhaTotal: 0,
        folhaColaboradores: 0,
      };

      const API_STATE_URL = "../api/state.php";
      const API_EMAIL_CODE_URL = "../api/email_code.php";
      const API_PASSWORD_RESET_URL = "../api/password_reset.php";
      const DEFAULT_COMPANY_CHIP_LOGO = "../assets/Logo.png";
      const LIMITE_MAXIMO_CREDITO = 890;
      const MAX_MEDIA_DATA_URI_CHARS = 220000;
      const MAX_LOGS_PERSIST = 1200;
      const STORAGE_KEY = "credtank-state";
      const LAST_TX_KEY = "credtank-last-tx";
      const COLAB_BIO_AUTO_KEY = "credtank-colab-bio-auto";
      const COLAB_BIO_AUTO_LAST_CPF_KEY = "credtank-colab-bio-auto-last-cpf";
      const COLAB_REGISTER_DRAFT_KEY = "credtank-colab-register-draft-v2";
      const COLAB_REGISTER_DRAFT_TTL_MS = 20 * 60 * 1000;
      const ALLOW_COLAB_AUTO_BIOMETRIC_LOGIN = true;
      const AUTO_SAVE_MS = 5000;
      const SESSION_REAUTH_MS = 15 * 60 * 1000;
      const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|wv/i.test(navigator.userAgent || "");
      const IS_ANDROID_WEBVIEW_APP = /CredTankAndroid\/1\.0/i.test(navigator.userAgent || "");
      const IS_DESKTOP_LIKE =
        window.matchMedia &&
        !MOBILE_UA &&
        (window.matchMedia("(min-width: 1024px)").matches || window.matchMedia("(pointer: fine)").matches);
      const REALTIME_SYNC_MS = IS_DESKTOP_LIKE ? 2500 : 900;
      const PENDING_WATCH_MS = IS_DESKTOP_LIKE ? 3000 : 1200;
      const LOCAL_SIGNAL_POLL_MS = IS_DESKTOP_LIKE ? 1500 : 700;
      const PENDING_PROMPT_DELAY_MS = 3000;
      const TX_STATUS = {
        PENDING: "pendente_confirmacao",
        CONFIRMED: "confirmada",
        DECLINED: "recusada",
      };
      let lastSavedPayload = "";
      let autoSaveTimer = null;
      let syncTimer = null;
      let serverStateHealthy = false;
      let serverStateLastError = "";
      let syncInProgress = false;
      let pendingSignalTimer = null;
      let lastPendingSignal = "";
      let pendingWatcher = null;
      let pendingWatcherInProgress = false;
      let activeConfirmTxId = null;
      let confirmSnoozeUntil = 0;
      let pendingPromptTimer = null;
      let pendingPromptForId = "";
      let lastPendingTxId = null;
      let lastNotifiedPendingTxId = "";
      let roleTabsCache = [];
      let activeEmpresaSection = "dashboard";
      let lastVisibilityHiddenAt = 0;
      let restoreExpiredSessionInfo = null;
      let txRevealTimer = null;
      let lastStateSaveError = "";
      let hasPendingServerSync = false;
      let stateSaveWorker = null;
      let pendingStateSaveRequest = null;
      let nativeBridgeCallbackSeq = 0;
      const nativeBridgeCallbacks = new Map();
      let notificationBootstrapRequested = false;
      let modalLockActive = false;
      let modalLockScrollY = 0;
      let modalVisibilityObserver = null;
      let colabCameraStream = null;
      let colabCameraFacingMode = "user";
      let colabCameraBusy = false;
      let colabRegisterDraftExpiryTimer = null;

      let currentUser = null;
      let editingFuncionarioId = null;
      let empresaFuncPage = 1;
      let editingEmpresaId = null;
      let editingPostoId = null;
      let viewingEmpresaFuncionarioId = null;
      let lastKnownLocation = null;
      const MAPS_ACCURACY_LIMIT = 500;
      const colabState = {
        mode: "login",
        fotoData: "",
        fotoCpf: "",
        emailCode: "",
        emailCodeFor: "",
        emailCodeCpf: "",
        emailCodeExpiresAt: 0,
        txPinCode: "",
        txPinCodeFor: "",
        txPinCodeFuncionarioId: "",
        txPinCodeExpiresAt: 0,
        txPinCodeSentAt: 0,
        forgotPendingCpf: "",
        forgotPendingChannel: "email",
        forgotMaskedDestination: "--",
        resetToken: "",
        resetTokenChannel: "",
        autoBiometricAttemptCpf: "",
        autoBiometricRunning: false,
      };

      const parseDate = (value) => {
        if (value instanceof Date) return value;

        if (typeof value === "number" && Number.isFinite(value)) {
          const ts = value > 1e12 ? value : value * 1000;
          const parsedNumber = new Date(ts);
          if (!Number.isNaN(parsedNumber.getTime())) return parsedNumber;
        }

        const raw = String(value || "").trim();
        if (!raw) return new Date();

        if (/^\d{10,13}$/.test(raw)) {
          const numeric = Number(raw);
          if (Number.isFinite(numeric)) {
            const ts = raw.length === 13 ? numeric : numeric * 1000;
            const parsedUnix = new Date(ts);
            if (!Number.isNaN(parsedUnix.getTime())) return parsedUnix;
          }
        }

        const brMatch = raw.match(
          /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
        );
        if (brMatch) {
          const day = Number(brMatch[1]);
          const month = Number(brMatch[2]);
          const year = Number(brMatch[3]);
          const hour = Number(brMatch[4] || 0);
          const minute = Number(brMatch[5] || 0);
          const second = Number(brMatch[6] || 0);
          const parsedBr = new Date(year, month - 1, day, hour, minute, second, 0);
          if (!Number.isNaN(parsedBr.getTime())) return parsedBr;
        }

        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
          const isoLike = raw.replace(" ", "T");
          const parsedMysql = new Date(isoLike);
          if (!Number.isNaN(parsedMysql.getTime())) return parsedMysql;
        }

        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
      };

      function normalizeTxStatus(value) {
        const raw = String(value || "").trim().toLowerCase();
        if (!raw) return TX_STATUS.CONFIRMED;
        if (
          raw === TX_STATUS.PENDING ||
          raw === "pendente" ||
          raw === "pending" ||
          raw === "pending_confirmation"
        ) {
          return TX_STATUS.PENDING;
        }
        if (
          raw === TX_STATUS.CONFIRMED ||
          raw === "confirmado" ||
          raw === "confirmed" ||
          raw === "aprovado" ||
          raw === "approved" ||
          raw === "ok"
        ) {
          return TX_STATUS.CONFIRMED;
        }
        if (
          raw === TX_STATUS.DECLINED ||
          raw === "recusado" ||
          raw === "declined" ||
          raw === "rejected" ||
          raw === "negado" ||
          raw === "denied" ||
          raw === "cancelado"
        ) {
          return TX_STATUS.DECLINED;
        }
        return raw;
      }

      const normalizeTransacoes = (entries) =>
        (Array.isArray(entries) ? entries : []).map((tx) => ({
          ...tx,
          status: normalizeTxStatus(tx.status),
          paymentSource: normalizePaymentSource(tx.paymentSource || tx.payment_source),
          timestamp: parseDate(
            tx.timestamp || tx.dataHora || tx.data_hora || tx.createdAt || tx.created_at || tx.confirmadoEm
          ),
        }));

      const normalizeLogs = (entries) =>
        (Array.isArray(entries) ? entries : []).map((log) => ({
          ...log,
          timestamp: parseDate(log.timestamp),
        }));

      const mergePendingTx = (tx) => {
        if (!tx || !tx.id) return;
        const normalized = {
          ...tx,
          status: normalizeTxStatus(tx.status || TX_STATUS.PENDING),
          paymentSource: normalizePaymentSource(tx.paymentSource || tx.payment_source),
          timestamp: parseDate(tx.timestamp || tx.dataHora || tx.data_hora || tx.createdAt || tx.created_at),
        };
        const index = state.transacoes.findIndex((entry) => entry.id === normalized.id);
        if (index === -1) {
          state.transacoes.unshift(normalized);
          return;
        }
        const existing = state.transacoes[index];
        if (existing && existing.status && existing.status !== TX_STATUS.PENDING && normalized.status === TX_STATUS.PENDING) {
          return;
        }
        state.transacoes[index] = { ...existing, ...normalized };
      };

      const mergeLocalPendingTx = (serverData, stored) => {
        if (!stored || !Array.isArray(stored.transacoes)) return serverData;
        const serverTxs = Array.isArray(serverData?.transacoes) ? serverData.transacoes : [];
        const serverIds = new Set(serverTxs.map((tx) => tx.id));
        const pending = stored.transacoes.filter(
          (tx) => tx && tx.status === TX_STATUS.PENDING && !serverIds.has(tx.id)
        );
        if (!pending.length) return serverData;
        return { ...serverData, transacoes: [...pending, ...serverTxs] };
      };

      const applyStateSnapshot = (snapshot) => {
        const safe = snapshot && typeof snapshot === "object" ? snapshot : {};
        const fallback = JSON.parse(JSON.stringify(DEFAULT_STATE));
        state.limitePadrao = Number.isFinite(safe.limitePadrao) ? safe.limitePadrao : fallback.limitePadrao;
        state.validadeMs = Number.isFinite(safe.validadeMs) ? safe.validadeMs : fallback.validadeMs;
        state.empresas = Array.isArray(safe.empresas) ? safe.empresas : fallback.empresas;
        state.postos = Array.isArray(safe.postos) ? safe.postos : fallback.postos;
        state.funcionarios = Array.isArray(safe.funcionarios) ? safe.funcionarios : fallback.funcionarios;
        state.usuarios = Array.isArray(safe.usuarios) ? safe.usuarios : fallback.usuarios;
        state.colaboradoresAuth = Array.isArray(safe.colaboradoresAuth) ? safe.colaboradoresAuth : fallback.colaboradoresAuth;
        state.transacoes = normalizeTransacoes(
          Array.isArray(safe.transacoes) ? safe.transacoes : fallback.transacoes
        );
        state.logs = normalizeLogs(Array.isArray(safe.logs) ? safe.logs : fallback.logs);
        applyLocalFixturesToState();
        state.usedTokens = new Set();
        state.currentToken = null;
        state.timerId = null;
        state.reportData = { ...REPORT_DATA_DEFAULT };
      };

      const loadStateFromStorage = () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return false;
          const parsed = JSON.parse(raw);
          applyStateSnapshot(parsed);
          return true;
        } catch (error) {
          return false;
        }
      };

      const readStoredState = () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" ? parsed : null;
        } catch (error) {
          return null;
        }
      };

      const broadcastTxChannel =
        "BroadcastChannel" in window ? new BroadcastChannel("credtank-tx") : null;

      const syncStateFromStorage = (payload) => {
        const stored = payload && typeof payload === "object" ? payload : readStoredState();
        if (!stored) return false;
        const beforeSignature = getStateSignature();
        const preserved = {
          currentToken: state.currentToken,
          timerId: state.timerId,
          usedTokens: state.usedTokens,
        };
        const safe = ensureAdminBootstrap(stored);
        const localTermsSource = state;
        if (localTermsSource) {
          mergeTerms(safe.usuarios, localTermsSource.usuarios);
          mergeTerms(safe.colaboradoresAuth, localTermsSource.colaboradoresAuth);
        }
        applyStateSnapshot(safe);
        state.currentToken = preserved.currentToken;
        state.timerId = preserved.timerId;
        state.usedTokens = preserved.usedTokens;
        rebindCurrentUserFromState();
        return beforeSignature !== getStateSignature();
      };

      const hasAuthData = (data) =>
        (Array.isArray(data?.usuarios) && data.usuarios.length > 0) ||
        (Array.isArray(data?.colaboradoresAuth) && data.colaboradoresAuth.length > 0);

      const ensureAdminBootstrap = (data) => data && typeof data === "object" ? { ...data } : {};

      const getPersistableState = () => ({
        limitePadrao: state.limitePadrao,
        validadeMs: state.validadeMs,
        empresas: state.empresas.map((empresa) => {
          const copy = { ...empresa };
          if (typeof copy.logoData === "string" && copy.logoData.length > MAX_MEDIA_DATA_URI_CHARS) {
            delete copy.logoData;
          }
          return copy;
        }),
        postos: state.postos.map((posto) => {
          const copy = { ...posto };
          if (typeof copy.logoData === "string" && copy.logoData.length > MAX_MEDIA_DATA_URI_CHARS) {
            delete copy.logoData;
          }
          return copy;
        }),
        funcionarios: state.funcionarios.map((funcionario) => {
          const copy = { ...funcionario };
          // A foto possui persistencia propria em app_funcionarios.foto_data.
          // Nao duplicar a imagem no app_state evita perda por snapshots grandes/stale.
          delete copy.fotoData;
          return copy;
        }),
        usuarios: state.usuarios,
        colaboradoresAuth: state.colaboradoresAuth,
        transacoes: state.transacoes,
        logs: state.logs.slice(0, MAX_LOGS_PERSIST),
      });

      const getStateSignature = (snapshot) => {
        try {
          const base = snapshot && typeof snapshot === "object" ? snapshot : getPersistableState();
          return JSON.stringify(base);
        } catch (error) {
          return "";
        }
      };

      const buildCompactPersistableState = (persistable) => ({
        ...persistable,
        empresas: Array.isArray(persistable?.empresas)
          ? persistable.empresas.map((empresa) => {
              const copy = { ...empresa };
              delete copy.logoData;
              return copy;
            })
          : [],
        postos: Array.isArray(persistable?.postos)
          ? persistable.postos.map((posto) => {
              const copy = { ...posto };
              delete copy.logoData;
              return copy;
            })
          : [],
        funcionarios: Array.isArray(persistable?.funcionarios)
          ? persistable.funcionarios.map((funcionario) => {
              const copy = { ...funcionario };
              delete copy.fotoData;
              return copy;
            })
          : [],
        transacoes: Array.isArray(persistable?.transacoes) ? persistable.transacoes.slice(0, 3000) : [],
        logs: Array.isArray(persistable?.logs) ? persistable.logs.slice(0, 400) : [],
      });

      const runStateSaveRequest = async (request) => {
        const force = Boolean(request?.force);
        const payload = String(request?.payload || "");
        const persistable = request?.persistable && typeof request.persistable === "object" ? request.persistable : {};
        if (!force && !hasPendingServerSync && payload === lastSavedPayload) return true;
        lastStateSaveError = "";
        if (DEMO_MODE) {
          try {
            localStorage.setItem(STORAGE_KEY, payload);
          } catch (error) {
            return false;
          }
          lastSavedPayload = payload;
          hasPendingServerSync = false;
          return true;
        }
        if (window.location.protocol === "file:") {
          try {
            localStorage.setItem(STORAGE_KEY, payload);
          } catch (error) {
            return false;
          }
          lastSavedPayload = payload;
          hasPendingServerSync = false;
          return true;
        }
        try {
          const response = await fetch(API_STATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
          });
          const result = await response.json().catch(() => null);
          if (!response.ok || (result && result.ok === false)) {
            lastStateSaveError = String(result?.error || `http_${response.status}`);
            const retryCompact =
              lastStateSaveError === "db_write_failed" ||
              lastStateSaveError === "db_encode_failed" ||
              lastStateSaveError === "http_413" ||
              /^http_5\d\d$/.test(lastStateSaveError);
            if (retryCompact) {
              const compactState = buildCompactPersistableState(persistable);
              const compactPayload = JSON.stringify(compactState);
              try {
                const retryResponse = await fetch(API_STATE_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: compactPayload,
                });
                const retryResult = await retryResponse.json().catch(() => null);
                if (retryResponse.ok && (!retryResult || retryResult.ok !== false)) {
                  lastSavedPayload = compactPayload;
                  hasPendingServerSync = false;
                  lastStateSaveError = "";
                  return true;
                }
                lastStateSaveError = String(retryResult?.error || `http_${retryResponse.status}`);
              } catch (retryError) {
                lastStateSaveError = "network_error";
              }
            }
            hasPendingServerSync = true;
            try {
              localStorage.setItem(STORAGE_KEY, payload);
            } catch (error) {
              return false;
            }
            return false;
          }
          lastSavedPayload = payload;
          hasPendingServerSync = false;
          return true;
        } catch (error) {
          lastStateSaveError = "network_error";
          hasPendingServerSync = true;
          try {
            localStorage.setItem(STORAGE_KEY, payload);
          } catch (storageError) {
            return false;
          }
          return false;
        }
      };

      const queueStateSave = (force = false) => {
        const persistable = getPersistableState();
        const payload = JSON.stringify(persistable);
        if (
          !force &&
          !hasPendingServerSync &&
          payload === lastSavedPayload &&
          !stateSaveWorker &&
          !pendingStateSaveRequest
        ) {
          return Promise.resolve(true);
        }

        const nextRequest = { force: Boolean(force), persistable, payload };
        if (pendingStateSaveRequest && pendingStateSaveRequest.payload === payload) {
          pendingStateSaveRequest.force = pendingStateSaveRequest.force || Boolean(force);
        } else {
          pendingStateSaveRequest = nextRequest;
        }

        if (stateSaveWorker) {
          return stateSaveWorker;
        }

        stateSaveWorker = (async () => {
          let allOk = true;
          while (pendingStateSaveRequest) {
            const currentRequest = pendingStateSaveRequest;
            pendingStateSaveRequest = null;
            const saved = await runStateSaveRequest(currentRequest);
            if (!saved) {
              allOk = false;
            }
          }
          stateSaveWorker = null;
          return allOk;
        })();

        return stateSaveWorker;
      };

      const deleteEmpresaOnServer = async (empresaId) => {
        if (DEMO_MODE || window.location.protocol === "file:") {
          return { ok: false, skipped: true };
        }
        try {
          const response = await fetch(API_STATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "delete_empresa",
              empresaId,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            return { ok: false, error: String(payload?.error || "") };
          }
          return { ok: true, data: payload.data || null };
        } catch (error) {
          return { ok: false, error: "network_error" };
        }
      };

      const deleteFuncionarioOnServer = async (funcionarioId) => {
        if (DEMO_MODE || window.location.protocol === "file:") {
          return { ok: false, skipped: true };
        }
        try {
          const response = await fetch(API_STATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "delete_funcionario",
              funcionarioId,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            return { ok: false, error: String(payload?.error || `http_${response.status}`) };
          }
          return { ok: true, data: payload.data || null };
        } catch (error) {
          return { ok: false, error: "network_error" };
        }
      };

      const createEmpresaOnServer = async ({ nome, cnpj, fechamento, limiteTipo, limiteValorFixo, loginEmail, loginSenha }) => {
        if (DEMO_MODE || window.location.protocol === "file:") {
          return { ok: false, skipped: true };
        }
        try {
          const response = await fetch(API_STATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add_empresa",
              nome,
              cnpj,
              fechamento,
              limiteTipo,
              limiteValorFixo,
              loginEmail,
              loginSenha,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            return { ok: false, error: String(payload?.error || `http_${response.status}`) };
          }
          return { ok: true, data: payload.data || null, warning: String(payload.warning || "") };
        } catch (error) {
          return { ok: false, error: "network_error" };
        }
      };

      const createPostoOnServer = async ({
        codigoMaquininha,
        codigoAcesso,
        nome,
        cnpj,
        cidade,
        localizacao,
        lat,
        lng,
        loginEmail,
        loginSenha,
      }) => {
        if (DEMO_MODE || window.location.protocol === "file:") {
          return { ok: false, skipped: true };
        }
        try {
          const response = await fetch(API_STATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add_posto",
              codigoMaquininha,
              codigoAcesso,
              nome,
              cnpj,
              cidade,
              localizacao,
              lat,
              lng,
              loginEmail,
              loginSenha,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            return { ok: false, error: String(payload?.error || `http_${response.status}`) };
          }
          return { ok: true, data: payload.data || null, warning: String(payload.warning || "") };
        } catch (error) {
          return { ok: false, error: "network_error" };
        }
      };

      const saveFuncionarioPhotoOnServer = async (funcionarioId, fotoData) => {
        if (DEMO_MODE || window.location.protocol === "file:") {
          return { ok: false, skipped: true };
        }
        try {
          const response = await fetch(API_STATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update_funcionario_photo",
              funcionarioId,
              fotoData,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            return { ok: false, error: String(payload?.error || `http_${response.status}`) };
          }
          return { ok: true, data: payload.data || null, warning: String(payload.warning || "") };
        } catch (error) {
          return { ok: false, error: "network_error" };
        }
      };

      const registerColaboradorOnServer = async ({
        funcionarioId,
        cpf,
        senha,
        senhaTransacao,
        email,
        telefone,
        fotoData,
      }) => {
        if (DEMO_MODE || window.location.protocol === "file:") {
          return { ok: false, skipped: true };
        }
        try {
          const response = await fetch(API_STATE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              action: "register_colaborador",
              funcionarioId,
              cpf,
              senha,
              senhaTransacao,
              email,
              telefone,
              fotoData,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            return { ok: false, error: String(payload?.error || `http_${response.status}`) };
          }
          return {
            ok: true,
            data: payload.data || null,
            auth: payload.auth || null,
            warning: String(payload.warning || ""),
          };
        } catch (error) {
          return { ok: false, error: "network_error" };
        }
      };

      const loadStateFromServer = async () => {
        if (DEMO_MODE) {
          return syncStateFromStorage();
        }
        if (window.location.protocol === "file:") {
          return syncStateFromStorage();
        }
        const beforeSignature = getStateSignature();
        if (hasPendingServerSync) {
          const recovered = await queueStateSave(true);
          if (!recovered) {
            return syncStateFromStorage();
          }
        }
        try {
          const response = await fetch(`${API_STATE_URL}?ts=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
          });
          if (!response.ok) {
            serverStateHealthy = false;
            serverStateLastError = `HTTP ${response.status}`;
            return syncStateFromStorage();
          }
          const payload = await response.json();
          if (payload && payload.data) {
            serverStateHealthy = true;
            serverStateLastError = "";
            const stored = readStoredState();
            const preserved = {
              currentToken: state.currentToken,
              timerId: state.timerId,
              usedTokens: state.usedTokens,
            };
            let data = payload.data;
            let shouldPersist = false;
            const serverTransacoes = Array.isArray(payload.data?.transacoes) ? payload.data.transacoes : null;
            if (!hasAuthData(data) && stored && hasAuthData(stored)) {
              data = stored;
              shouldPersist = true;
              if (serverTransacoes) {
                data.transacoes = mergeById(data.transacoes || [], serverTransacoes);
              }
            }
            if (!hasAuthData(data)) {
              data = ensureAdminBootstrap(data);
              shouldPersist = true;
              if (serverTransacoes) {
                data.transacoes = mergeById(data.transacoes || [], serverTransacoes);
              }
            }
            const localTermsSource = stored && hasAuthData(stored) ? stored : state;
            if (localTermsSource) {
              mergeTerms(data.usuarios, localTermsSource.usuarios);
              mergeTerms(data.colaboradoresAuth, localTermsSource.colaboradoresAuth);
            }
            if (stored) {
              data = mergeLocalPendingTx(data, stored);
            }
            applyStateSnapshot(data);
            state.currentToken = preserved.currentToken;
            state.timerId = preserved.timerId;
            state.usedTokens = preserved.usedTokens;
            rebindCurrentUserFromState();
            autoPromptPendingTx();
            const changed = beforeSignature !== getStateSignature();
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch (error) {
              return changed;
            }
            if (shouldPersist) {
              queueStateSave(true);
            }
            return changed;
          } else {
            serverStateHealthy = false;
            serverStateLastError = "Resposta invalida da API";
            return syncStateFromStorage();
          }
        } catch (error) {
          serverStateHealthy = false;
          serverStateLastError = "Falha de conexao com a API";
          return syncStateFromStorage();
        }
      };

      const startAutoSave = () => {
        if (!DEMO_MODE && window.location.protocol !== "file:" && !serverStateHealthy) {
          return;
        }
        if (autoSaveTimer) {
          clearInterval(autoSaveTimer);
        }
        autoSaveTimer = setInterval(() => queueStateSave(false), AUTO_SAVE_MS);
        queueStateSave(true);
      };

      const startRealtimeSync = () => {
        if (syncTimer) {
          clearInterval(syncTimer);
          syncTimer = null;
        }
        const runSyncTick = async () => {
          if (syncInProgress || !currentUser || document.hidden) return;
          syncInProgress = true;
          try {
            const changed = await loadStateFromServer();
            if (serverStateHealthy && !autoSaveTimer) {
              startAutoSave();
            }
            if (!changed) {
              if (currentUser?.role === "admin") renderAdmin();
              return;
            }
            refreshAllViews();
            autoPromptPendingTx();
          } finally {
            syncInProgress = false;
          }
        };
        syncTimer = setInterval(runSyncTick, REALTIME_SYNC_MS);
        // Mobile sente mais latencia; dispara uma passada imediata ao iniciar o watcher.
        if (currentUser && !document.hidden) {
          runSyncTick();
        }
      };

      window.addEventListener("beforeunload", () => {
        if (colabState.mode === "register") saveColabRegisterDraft();
        stopColabCamera();
        markSessionBackgrounded();
        queueStateSave(true);
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          lastVisibilityHiddenAt = Date.now();
          if (colabState.mode === "register") saveColabRegisterDraft();
          markSessionBackgrounded();
          return;
        }
        if (!currentUser) return;
        const enforceReauth = shouldEnforceSessionReauth();
        const hiddenForMs = lastVisibilityHiddenAt ? Date.now() - lastVisibilityHiddenAt : 0;
        if (enforceReauth && hiddenForMs > SESSION_REAUTH_MS) {
          forceSessionReauth("Sessao expirada no mobile por seguranca. Entre novamente.");
          return;
        }
        markSessionUnlocked();
        loadStateFromServer().then((changed) => {
          if (changed) {
            refreshAllViews();
          }
        });
      });

      window.addEventListener("online", () => {
        if (!currentUser || document.hidden) return;
        loadStateFromServer().then((changed) => {
          if (changed) {
            refreshAllViews();
          }
          autoPromptPendingTx();
        });
      });

      window.addEventListener("storage", (event) => {
        if (event.storageArea !== localStorage) return;
        if (event.key === STORAGE_KEY) {
          if (!event.newValue) return;
          let parsed;
          try {
            parsed = JSON.parse(event.newValue);
          } catch (error) {
            return;
          }
          if (!syncStateFromStorage(parsed)) return;
          refreshAllViews();
          autoPromptPendingTx();
          return;
        }
        if (event.key === LAST_TX_KEY) return;
      });

      const elements = {
        authScreen: document.getElementById("auth-screen"),
        portal: document.getElementById("portal"),
        loginForm: document.getElementById("login-form"),
        loginEmail: document.getElementById("login-email"),
        loginPassword: document.getElementById("login-password"),
        loginMessage: document.getElementById("login-message"),
        rememberCheck: document.getElementById("remember-check"),
        authModeLabel: document.getElementById("auth-mode-label"),
        authPanels: {
          corporativo: document.getElementById("auth-corporativo"),
          colaborador: document.getElementById("auth-colaborador"),
        },
        authTabs: document.querySelectorAll(".auth-tab"),
        colabForm: document.getElementById("colab-form"),
        colabCpf: document.getElementById("colab-cpf"),
        colabSenha: document.getElementById("colab-senha"),
        colabSenhaConfirm: document.getElementById("colab-senha-confirm"),
        colabTxPin: document.getElementById("colab-tx-pin"),
        colabTxPinConfirm: document.getElementById("colab-tx-pin-confirm"),
        colabEmail: document.getElementById("colab-email"),
        colabTelefone: document.getElementById("colab-telefone"),
        colabEmailCode: document.getElementById("colab-email-code"),
        colabEmailSendCode: document.getElementById("colab-email-send-code"),
        colabFotoInput: document.getElementById("colab-foto"),
        colabFotoPreview: document.getElementById("colab-foto-preview"),
        colabFotoPreviewWrap: document.getElementById("colab-foto-preview-wrap"),
        colabCameraOpen: document.getElementById("colab-camera-open"),
        colabCameraModal: document.getElementById("colab-camera-modal"),
        colabCameraBackdrop: document.querySelector('[data-close="colab-camera-modal"]'),
        colabCameraClose: document.getElementById("colab-camera-close"),
        colabCameraVideo: document.getElementById("colab-camera-video"),
        colabCameraFrame: document.getElementById("colab-camera-frame"),
        colabCameraOffline: document.getElementById("colab-camera-offline"),
        colabCameraMsg: document.getElementById("colab-camera-msg"),
        colabCameraSwitch: document.getElementById("colab-camera-switch"),
        colabCameraCapture: document.getElementById("colab-camera-capture"),
        colabMessage: document.getElementById("colab-message"),
        colabRememberCheck: document.getElementById("colab-remember-check"),
        colabSubmit: document.getElementById("colab-submit"),
        colabHint: document.getElementById("colab-hint"),
        colabBioAutoOption: document.getElementById("colab-bio-auto-option"),
        colabBioAutoCheck: document.getElementById("colab-bio-auto-check"),
        colabBioLogin: document.getElementById("colab-bio-login"),
        colabBioToggleLogin: document.getElementById("colab-bio-toggle-login"),
        colabBioToggleMsg: document.getElementById("colab-bio-toggle-msg"),
        colabForgot: document.getElementById("colab-forgot"),
        colabForgotModal: document.getElementById("colab-forgot-modal"),
        colabForgotClose: document.getElementById("colab-forgot-close"),
        colabForgotBackdrop: document.querySelector('[data-close="colab-forgot-modal"]'),
        colabForgotCpf: document.getElementById("colab-forgot-cpf"),
        colabForgotContactMask: document.getElementById("colab-forgot-contact-mask"),
        colabForgotSendCode: document.getElementById("colab-forgot-send-code"),
        colabForgotMsg: document.getElementById("colab-forgot-msg"),
        colabResetModal: document.getElementById("colab-reset-modal"),
        colabResetClose: document.getElementById("colab-reset-close"),
        colabResetCancel: document.getElementById("colab-reset-cancel"),
        colabResetOk: document.getElementById("colab-reset-ok"),
        colabResetBackdrop: document.querySelector('[data-close="colab-reset-modal"]'),
        colabResetContactMask: document.getElementById("colab-reset-contact-mask"),
        colabResetPassword: document.getElementById("colab-reset-password"),
        colabResetPasswordConfirm: document.getElementById("colab-reset-password-confirm"),
        colabResetMsg: document.getElementById("colab-reset-msg"),
        maquininhaForm: document.getElementById("maquininha-form"),
        maquininhaCodigo: document.getElementById("maquininha-codigo"),
        maquininhaPostoNome: document.getElementById("maquininha-posto-nome"),
        maquininhaPin: document.getElementById("maquininha-pin"),
        maquininhaMessage: document.getElementById("maquininha-message"),
        brandLogo: document.getElementById("brand-logo"),
        companyChip: document.getElementById("company-chip"),
        companyChipLogo: document.getElementById("company-chip-logo"),
        companyChipName: document.getElementById("company-chip-name"),
        funcionarioCompanyLogo: document.getElementById("funcionario-company-logo"),
        userChip: document.getElementById("user-chip"),
        logoutBtn: document.getElementById("logout-btn"),
        empresaSelect: document.getElementById("empresa-select"),
        funcionarioSelect: document.getElementById("funcionario-select"),
        postoSelect: document.getElementById("posto-select"),
        valorInput: document.getElementById("valor-input"),
        gerarToken: document.getElementById("gerar-token"),
        funcMsg: document.getElementById("func-msg"),
        funcionarioInativoBanner: document.getElementById("funcionario-inativo-banner"),
        funcionarioFotoBanner: document.getElementById("funcionario-foto-banner"),
        kpiLimit: document.getElementById("kpi-limit"),
        kpiBalance: document.getElementById("kpi-balance"),
        kpiLimitHome: document.getElementById("kpi-limit-home"),
        kpiBalanceHome: document.getElementById("kpi-balance-home"),
        tokenStatus: document.getElementById("token-status"),
        tokenTimer: document.getElementById("token-timer"),
        tokenValue: document.getElementById("token-value"),
        tokenMsg: document.getElementById("token-msg"),
        copyToken: document.getElementById("copy-token"),
        clearToken: document.getElementById("clear-token"),
        homeTransacoesList: document.getElementById("home-transacoes-list"),
        homeTransacoesMsg: document.getElementById("home-transacoes-msg"),
        profileNome: document.getElementById("profile-nome"),
        profileCpf: document.getElementById("profile-cpf"),
        profileMatricula: document.getElementById("profile-matricula"),
        profileEmpresa: document.getElementById("profile-empresa"),
        profileStatus: document.getElementById("profile-status"),
        profileStatusPill: document.getElementById("profile-status-pill"),
        profileEmail: document.getElementById("profile-email"),
        profileTelefone: document.getElementById("profile-telefone"),
        profileSalario: document.getElementById("profile-salario"),
        profileLimite: document.getElementById("profile-limite"),
        profileConsumoMes: document.getElementById("profile-consumo-mes"),
        profileSaldo: document.getElementById("profile-saldo"),
        profileUtilizacao: document.getElementById("profile-utilizacao"),
        profileUtilizacaoFill: document.getElementById("profile-utilizacao-fill"),
        profileFoto: document.getElementById("profile-foto"),
        profileFotoPlaceholder: document.getElementById("profile-foto-placeholder"),
        profileFotoInput: document.getElementById("profile-foto-input"),
        profileFotoMsg: document.getElementById("profile-foto-msg"),
        profilePhotoWarning: document.getElementById("profile-photo-warning"),
        passwordForm: document.getElementById("password-form"),
        passwordEmailSend: document.getElementById("password-email-send"),
        passwordEmailHint: document.getElementById("password-email-hint"),
        passwordCurrent: document.getElementById("password-current"),
        passwordNew: document.getElementById("password-new"),
        passwordConfirm: document.getElementById("password-confirm"),
        passwordMsg: document.getElementById("password-msg"),
        settingsGear: document.getElementById("settings-gear"),
        balanceVisibilityToggle: document.getElementById("balance-visibility-toggle"),
        bioToggle: document.getElementById("bio-toggle"),
        notifyToggle: document.getElementById("notify-toggle"),
        settingsMsg: document.getElementById("settings-msg"),
        settingsPassword: document.getElementById("settings-password"),
        settingsTxPin: document.getElementById("settings-tx-pin"),
        settingsTxReveal: document.getElementById("settings-tx-reveal"),
        txPinForm: document.getElementById("tx-pin-form"),
        txPinAccess: document.getElementById("tx-pin-access"),
        txPinCurrent: document.getElementById("tx-pin-current"),
        txPinNew: document.getElementById("tx-pin-new"),
        txPinConfirm: document.getElementById("tx-pin-confirm"),
        txPinCode: document.getElementById("tx-pin-code"),
        txPinSendCode: document.getElementById("tx-pin-send-code"),
        txPinCodeHint: document.getElementById("tx-pin-code-hint"),
        txPinMsg: document.getElementById("tx-pin-msg"),
        txRevealAccess: document.getElementById("tx-reveal-access"),
        txRevealValue: document.getElementById("tx-reveal-value"),
        txRevealBtn: document.getElementById("tx-reveal-btn"),
        txRevealBio: document.getElementById("tx-reveal-bio"),
        txRevealMsg: document.getElementById("tx-reveal-msg"),
        qrCanvas: document.getElementById("qr-canvas"),
        scannerVideo: document.getElementById("scanner-video"),
        scannerCanvas: document.getElementById("scanner-canvas"),
        scannerStart: document.getElementById("scanner-start"),
        scannerStop: document.getElementById("scanner-stop"),
        scannerStatus: document.getElementById("scanner-status"),
        scannerMsg: document.getElementById("scanner-msg"),
        scannerFile: document.getElementById("scanner-file"),
        leitorPosto: document.getElementById("leitor-posto"),
        leitorCombustivel: document.getElementById("leitor-combustivel"),
        leitorToken: document.getElementById("leitor-token"),
        validarToken: document.getElementById("validar-token"),
        simularLeitura: document.getElementById("simular-leitura"),
        leitorMsg: document.getElementById("leitor-msg"),
        resultStatus: document.getElementById("result-status"),
        resultAmount: document.getElementById("result-amount"),
        resultDetails: document.getElementById("result-details"),
        postoNearestStatus: document.getElementById("posto-nearest-status"),
        postoNearestName: document.getElementById("posto-nearest-name"),
        postoNearestDetails: document.getElementById("posto-nearest-details"),
        postoNearestBtn: document.getElementById("posto-nearest-btn"),
        postoNearestMsg: document.getElementById("posto-nearest-msg"),
        postoMapsLink: document.getElementById("posto-maps-link"),
        postoList: document.getElementById("posto-list"),
        postoListMsg: document.getElementById("posto-list-msg"),
        postoMonthFilter: document.getElementById("posto-month-filter"),
        postoFilterApply: document.getElementById("posto-filter-apply"),
        transacoesList: document.getElementById("transacoes-list"),
        periodoLabel: document.getElementById("periodo-label"),
        reportMsg: document.getElementById("report-msg"),
        reportExportType: document.getElementById("report-export-type"),
        reportExportFormat: document.getElementById("report-export-format"),
        reportPeriodStart: document.getElementById("report-period-start"),
        reportPeriodEnd: document.getElementById("report-period-end"),
        reportApplyBtn: document.getElementById("report-apply-btn"),
        reportExportBtn: document.getElementById("report-export-btn"),
        relatorioFuncionario: document.getElementById("relatorio-funcionario"),
        relatorioEmpresaSelect: document.getElementById("relatorio-empresa-select"),
        relatorioFolhaEmpresa: document.getElementById("relatorio-folha-empresa"),
        relatorioEmpresaPostoWrap: document.getElementById("relatorio-posto-empresa-wrap"),
        relatorioEmpresaPosto: document.getElementById("relatorio-empresa-posto"),
        relatorioPostoSelect: document.getElementById("relatorio-posto-select"),
        reportLogoExtrato: document.getElementById("report-logo-extrato"),
        reportBrandNameExtrato: document.getElementById("report-brand-name-extrato"),
        reportBrandMetaExtrato: document.getElementById("report-brand-meta-extrato"),
        reportLogoEmpresa: document.getElementById("report-logo-empresa"),
        reportBrandNameEmpresa: document.getElementById("report-brand-name-empresa"),
        reportBrandMetaEmpresa: document.getElementById("report-brand-meta-empresa"),
        reportLogoFolha: document.getElementById("report-logo-folha"),
        reportBrandNameFolha: document.getElementById("report-brand-name-folha"),
        reportBrandMetaFolha: document.getElementById("report-brand-meta-folha"),
        reportLogoRepasse: document.getElementById("report-logo-repasse"),
        reportBrandNameRepasse: document.getElementById("report-brand-name-repasse"),
        reportBrandMetaRepasse: document.getElementById("report-brand-meta-repasse"),
        extratoIdentificacao: document.getElementById("extrato-identificacao"),
        extratoTable: document.getElementById("extrato-table").querySelector("tbody"),
        extratoTotal: document.getElementById("extrato-total"),
        empresaNome: document.getElementById("relatorio-empresa-nome"),
        empresaTable: document.getElementById("empresa-table").querySelector("tbody"),
        empresaTotal: document.getElementById("empresa-total"),
        folhaIdentificacao: document.getElementById("folha-identificacao"),
        folhaTable: document.getElementById("folha-table").querySelector("tbody"),
        folhaTotal: document.getElementById("folha-total"),
        repasseTable: document.getElementById("repasse-table").querySelector("tbody"),
        repasseTotal: document.getElementById("repasse-total"),
        repasseCol1: document.getElementById("repasse-col-1"),
        repasseCol2: document.getElementById("repasse-col-2"),
        repasseCol3: document.getElementById("repasse-col-3"),
        repasseCol4: document.getElementById("repasse-col-4"),
        repasseCol5: document.getElementById("repasse-col-5"),
        repasseCol6: document.getElementById("repasse-col-6"),
        repasseCol7: document.getElementById("repasse-col-7"),
        repasseCol8: document.getElementById("repasse-col-8"),
        empresaDashboardNome: document.getElementById("empresa-dashboard-nome"),
        empresaSections: document.getElementById("empresa-sections"),
        empresaMonthFilter: document.getElementById("empresa-month-filter"),
        empresaFilterApply: document.getElementById("empresa-filter-apply"),
        empresaLimiteTipo: document.getElementById("empresa-limite-tipo"),
        empresaLimiteFixoWrap: document.getElementById("empresa-limite-fixo-wrap"),
        empresaLimiteFixo: document.getElementById("empresa-limite-fixo"),
        empresaLimiteResumo: document.getElementById("empresa-limite-resumo"),
        empresaLimiteSave: document.getElementById("empresa-limite-save"),
        empresaLimiteMsg: document.getElementById("empresa-limite-msg"),
        empresaConvenioList: document.getElementById("empresa-convenio-list"),
        empresaConvenioSave: document.getElementById("empresa-convenio-save"),
        empresaConvenioMsg: document.getElementById("empresa-convenio-msg"),
        empresaConvenioDetailsBody: document.getElementById("empresa-convenio-details-body"),
        empresaConvenioActiveCount: document.getElementById("empresa-convenio-active-count"),
        empresaConvenioTotalCount: document.getElementById("empresa-convenio-total-count"),
        empresaKpiFuncionarios: document.getElementById("empresa-kpi-funcionarios"),
        empresaKpiFuncionariosInativos: document.getElementById("empresa-kpi-funcionarios-inativos"),
        empresaKpiSaldoZerado: document.getElementById("empresa-kpi-saldo-zerado"),
        empresaKpiTransacoes: document.getElementById("empresa-kpi-transacoes"),
        empresaKpiTotal: document.getElementById("empresa-kpi-total"),
        empresaKpiLimite: document.getElementById("empresa-kpi-limite"),
        empresaKpiSaldo: document.getElementById("empresa-kpi-saldo"),
        empresaKpiReset: document.getElementById("empresa-kpi-reset"),
        empresaKpiResetNote: document.getElementById("empresa-kpi-reset-note"),
        empresaLimiteResetInfo: document.getElementById("empresa-limite-reset-info"),
        postoReportSummary: document.getElementById("posto-report-summary"),
        empresaReportPager: document.getElementById("empresa-report-pager"),
        empresaKpiTicketMedio: document.getElementById("empresa-kpi-ticket-medio"),
        empresaKpiUtilizacao: document.getElementById("empresa-kpi-utilizacao"),
        empresaKpiPostos: document.getElementById("empresa-kpi-postos"),
        empresaTopList: document.getElementById("empresa-top-list"),
        empresaConsumoTable: document.getElementById("empresa-consumo-table").querySelector("tbody"),
        empresaConsumoNote: document.getElementById("empresa-consumo-note"),
        empresaFuncNome: document.getElementById("empresa-func-nome"),
        empresaFuncCpf: document.getElementById("empresa-func-cpf"),
        empresaFuncMatricula: document.getElementById("empresa-func-matricula"),
        empresaFuncContrato: document.getElementById("empresa-func-contrato"),
        empresaFuncLocalidade: document.getElementById("empresa-func-localidade"),
        empresaFuncEmail: document.getElementById("empresa-func-email"),
        empresaFuncTelefone: document.getElementById("empresa-func-telefone"),
        empresaFuncSalario: document.getElementById("empresa-func-salario"),
        empresaFuncSenha: document.getElementById("empresa-func-senha"),
        empresaFuncTxPin: document.getElementById("empresa-func-tx-pin"),
        empresaFuncAdd: document.getElementById("empresa-func-add"),
        empresaFuncMsg: document.getElementById("empresa-func-msg"),
        empresaFuncSearch: document.getElementById("empresa-func-search"),
        empresaFuncContratoFilter: document.getElementById("empresa-func-contrato-filter"),
        empresaFuncLocalidadeFilter: document.getElementById("empresa-func-localidade-filter"),
        empresaFuncSort: document.getElementById("empresa-func-sort"),
        empresaOrgTableBody: document.getElementById("empresa-org-table-body"),
        empresaOrgCount: document.getElementById("empresa-org-count"),
        empresaFuncPageSize: document.getElementById("empresa-func-page-size"),
        empresaFuncPageLabel: document.getElementById("empresa-func-page-label"),
        empresaFuncPrev: document.getElementById("empresa-func-prev"),
        empresaFuncNext: document.getElementById("empresa-func-next"),
        empresaFuncList: document.getElementById("empresa-func-list"),
        empresaFuncListSummary: document.getElementById("empresa-func-list-summary"),
        empresaFuncListMsg: document.getElementById("empresa-func-list-msg"),
        empresaFuncProfileModal: document.getElementById("empresa-func-profile-modal"),
        empresaFuncProfileClose: document.getElementById("empresa-func-profile-close"),
        empresaFuncProfileBackdrop: document.querySelector('[data-close="empresa-func-profile-modal"]'),
        empresaFuncProfileSub: document.getElementById("empresa-func-profile-sub"),
        empresaFuncProfileGrid: document.getElementById("empresa-func-profile-grid"),
        empresaFuncProfileFinance: document.getElementById("empresa-func-profile-finance"),
        empresaSelfId: document.getElementById("empresa-self-id"),
        empresaSelfLoginStatus: document.getElementById("empresa-self-login-status"),
        empresaSelfNome: document.getElementById("empresa-self-nome"),
        empresaSelfCnpj: document.getElementById("empresa-self-cnpj"),
        empresaSelfFechamento: document.getElementById("empresa-self-fechamento"),
        empresaSelfEmail: document.getElementById("empresa-self-email"),
        empresaSelfSenha: document.getElementById("empresa-self-senha"),
        empresaSelfSave: document.getElementById("empresa-self-save"),
        empresaSelfMsg: document.getElementById("empresa-self-msg"),
        adminKpiEmpresas: document.getElementById("admin-kpi-empresas"),
        adminKpiFuncionarios: document.getElementById("admin-kpi-funcionarios"),
        adminKpiPostos: document.getElementById("admin-kpi-postos"),
        adminKpiTransacoes: document.getElementById("admin-kpi-transacoes"),
        adminKpiTotal: document.getElementById("admin-kpi-total"),
        adminTransacoesResumo: document.getElementById("admin-transacoes-resumo").querySelector("tbody"),
        empresaNomeInput: document.getElementById("empresa-nome"),
        empresaCnpjInput: document.getElementById("empresa-cnpj"),
        empresaFechamentoInput: document.getElementById("empresa-fechamento"),
        empresaLimiteTipoAdmin: document.getElementById("empresa-limite-tipo-admin"),
        empresaLimiteFixoAdminWrap: document.getElementById("empresa-limite-fixo-admin-wrap"),
        empresaLimiteFixoAdmin: document.getElementById("empresa-limite-fixo-admin"),
        empresaLoginEmail: document.getElementById("empresa-login-email"),
        empresaLoginSenha: document.getElementById("empresa-login-senha"),
        empresaAdd: document.getElementById("empresa-add"),
        empresaMsg: document.getElementById("empresa-msg"),
        empresaAdminList: document.getElementById("empresa-admin-list"),
        empresaAdminListMsg: document.getElementById("empresa-admin-list-msg"),
        empresaAdminCount: document.getElementById("empresa-admin-count"),
        funcNomeInput: document.getElementById("func-nome"),
        funcCpfInput: document.getElementById("func-cpf"),
        funcMatriculaInput: document.getElementById("func-matricula"),
        funcEmpresaSelect: document.getElementById("func-empresa"),
        funcContratoInput: document.getElementById("func-contrato"),
        funcLocalidadeInput: document.getElementById("func-localidade"),
        funcEmailInput: document.getElementById("func-email"),
        funcTelefoneInput: document.getElementById("func-telefone"),
        funcSalarioInput: document.getElementById("func-salario"),
        funcSenhaInput: document.getElementById("func-senha"),
        funcTxPinInput: document.getElementById("func-tx-pin"),
        funcAdd: document.getElementById("func-add"),
        funcMsgAdmin: document.getElementById("func-msg-admin"),
        funcAdminTable: document.getElementById("func-admin-list"),
        adminDbStatus: document.getElementById("admin-db-status"),
        funcAdminCount: document.getElementById("func-admin-count"),
        funcAdminSearch: document.getElementById("admin-func-search"),
        funcAdminEmpresaFilter: document.getElementById("admin-func-empresa-filter"),
        funcAdminStatusFilter: document.getElementById("admin-func-status-filter"),
        funcAdminSummary: document.getElementById("admin-func-summary"),
        funcAdminListMsg: document.getElementById("func-admin-list-msg"),
        postoCodigoInput: document.getElementById("posto-codigo"),
        postoAcessoInput: document.getElementById("posto-acesso"),
        postoNomeInput: document.getElementById("posto-nome"),
        postoCnpjInput: document.getElementById("posto-cnpj"),
        postoCidadeInput: document.getElementById("posto-cidade"),
        postoLocalizacaoInput: document.getElementById("posto-localizacao"),
        postoLoginEmail: document.getElementById("posto-email"),
        postoLoginSenha: document.getElementById("posto-senha"),
        postoPreviewLink: document.getElementById("posto-preview-link"),
        postoCaptureBtn: document.getElementById("posto-capture-btn"),
        postoAdd: document.getElementById("posto-add"),
        postoMsgAdmin: document.getElementById("posto-msg-admin"),
        postoAdminList: document.getElementById("posto-admin-list"),
        postoAdminListMsg: document.getElementById("posto-admin-list-msg"),
        postoDashboardNome: document.getElementById("posto-dashboard-nome"),
        postoEmpresaFilter: document.getElementById("posto-empresa-filter"),
        postoKpiTransacoes: document.getElementById("posto-kpi-transacoes"),
        postoKpiPendentes: document.getElementById("posto-kpi-pendentes"),
        postoKpiConfirmadas: document.getElementById("posto-kpi-confirmadas"),
        postoKpiTotal: document.getElementById("posto-kpi-total"),
        postoKpiTicket: document.getElementById("posto-kpi-ticket"),
        postoKpiEmpresas: document.getElementById("posto-kpi-empresas"),
        postoKpiMaiorEmpresa: document.getElementById("posto-kpi-maior-empresa"),
        postoTransacoesList: document.getElementById("posto-transacoes-list"),
        postoTransacoesMsg: document.getElementById("posto-transacoes-msg"),
        postoEmpresaTable: document.getElementById("posto-empresa-table").querySelector("tbody"),
        postoPendentesList: document.getElementById("posto-pendentes-list"),
        postoPendentesMsg: document.getElementById("posto-pendentes-msg"),
        postoOpenLeitor: document.getElementById("posto-open-leitor"),
        adminFilterEmpresa: document.getElementById("admin-filter-empresa"),
        adminFilterPosto: document.getElementById("admin-filter-posto"),
        adminTransacoesTable: document.getElementById("admin-transacoes-table").querySelector("tbody"),
        adminKpiAtivasEmpresas: document.getElementById("admin-kpi-ativas-empresas"),
        adminKpiPendentes: document.getElementById("admin-kpi-pendentes"),
        adminKpiTicket: document.getElementById("admin-kpi-ticket"),
        adminKpiLimiteTotal: document.getElementById("admin-kpi-limite-total"),
        adminRiskList: document.getElementById("admin-risk-list"),
        adminTopEmpresas: document.getElementById("admin-top-empresas"),
        auditList: document.getElementById("audit-list"),
        configValidade: document.getElementById("config-validade"),
        configBtn: document.getElementById("config-btn"),
        configMsg: document.getElementById("config-msg"),
        resetMonth: document.getElementById("reset-month"),
        funcModal: document.getElementById("func-modal"),
        funcModalClose: document.getElementById("func-modal-close"),
        funcModalSave: document.getElementById("func-modal-save"),
        funcModalMsg: document.getElementById("func-modal-msg"),
        funcModalNome: document.getElementById("func-modal-nome"),
        funcModalCpf: document.getElementById("func-modal-cpf"),
        funcModalMatricula: document.getElementById("func-modal-matricula"),
        funcModalContrato: document.getElementById("func-modal-contrato"),
        funcModalLocalidade: document.getElementById("func-modal-localidade"),
        funcModalEmail: document.getElementById("func-modal-email"),
        funcModalTelefone: document.getElementById("func-modal-telefone"),
        funcModalSalario: document.getElementById("func-modal-salario"),
        empresaModal: document.getElementById("empresa-modal"),
        empresaModalClose: document.getElementById("empresa-modal-close"),
        empresaModalSave: document.getElementById("empresa-modal-save"),
        empresaModalMsg: document.getElementById("empresa-modal-msg"),
        empresaModalNome: document.getElementById("empresa-modal-nome"),
        empresaModalCnpj: document.getElementById("empresa-modal-cnpj"),
        empresaModalFechamento: document.getElementById("empresa-modal-fechamento"),
        empresaModalLimiteTipo: document.getElementById("empresa-modal-limite-tipo"),
        empresaModalLimiteFixoWrap: document.getElementById("empresa-modal-limite-fixo-wrap"),
        empresaModalLimiteFixo: document.getElementById("empresa-modal-limite-fixo"),
        empresaModalEmail: document.getElementById("empresa-modal-email"),
        empresaModalSenha: document.getElementById("empresa-modal-senha"),
        empresaLogoInput: document.getElementById("empresa-logo-input"),
        empresaLogoPreview: document.getElementById("empresa-logo-preview"),
        empresaLogoPlaceholder: document.getElementById("empresa-logo-placeholder"),
        empresaLogoMsg: document.getElementById("empresa-logo-msg"),
        empresaLogoRemove: document.getElementById("empresa-logo-remove"),
        postoModal: document.getElementById("posto-modal"),
        postoModalClose: document.getElementById("posto-modal-close"),
        postoModalSave: document.getElementById("posto-modal-save"),
        postoModalMsg: document.getElementById("posto-modal-msg"),
        postoModalCodigo: document.getElementById("posto-modal-codigo"),
        postoModalAcesso: document.getElementById("posto-modal-acesso"),
        postoModalNome: document.getElementById("posto-modal-nome"),
        postoModalCnpj: document.getElementById("posto-modal-cnpj"),
        postoModalCidade: document.getElementById("posto-modal-cidade"),
        postoModalLocalizacao: document.getElementById("posto-modal-localizacao"),
        postoModalEmail: document.getElementById("posto-modal-email"),
        postoModalSenha: document.getElementById("posto-modal-senha"),
        postoModalLogoInput: document.getElementById("posto-modal-logo"),
        postoModalLogoPreview: document.getElementById("posto-modal-logo-preview"),
        postoModalLogoPlaceholder: document.getElementById("posto-modal-logo-placeholder"),
        postoModalLogoRemove: document.getElementById("posto-modal-logo-remove"),
        termsModal: document.getElementById("terms-modal"),
        termsAccept: document.getElementById("terms-accept"),
        termsDecline: document.getElementById("terms-decline"),
        termsCheck: document.getElementById("terms-check"),
        termsName: document.getElementById("terms-name"),
        termsMsg: document.getElementById("terms-msg"),
        txConfirmModal: document.getElementById("tx-confirm-modal"),
        txConfirmBackdrop: document.querySelector('[data-close="tx-confirm-modal"]'),
        txConfirmClose: document.getElementById("tx-confirm-close"),
        txConfirmLater: document.getElementById("tx-confirm-later"),
        txConfirmSubmit: document.getElementById("tx-confirm-submit"),
        txConfirmPassword: document.getElementById("tx-confirm-password"),
        txConfirmAmount: document.getElementById("tx-confirm-amount"),
        txConfirmPosto: document.getElementById("tx-confirm-posto"),
        txConfirmId: document.getElementById("tx-confirm-id"),
        txConfirmPaymentSource: document.getElementById("tx-confirm-payment-source"),
        txConfirmMsg: document.getElementById("tx-confirm-msg"),
      };

      // Public checksum compatibility salt; not an authentication secret.
      const QR_CHECKSUM_SALT = "CREDTANK-PORTAL-ASSINATURA";
      const SESSION_KEY = "credtank-session";
      const LEGACY_SESSION_KEYS = ["gwl-session"];
      const TX_REVEAL_MASK = "****";
      const MAPS_ICON =
        '<span class="maps-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path fill="#1a73e8" d="M12 2C8.14 2 5 5.14 5 9.02c0 5.09 6.4 12.47 6.67 12.78.18.2.49.2.67 0 .27-.31 6.66-7.69 6.66-12.78C19 5.14 15.86 2 12 2zm0 10.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4z"/></svg></span>';
      const mapsLabel = (text) => `${MAPS_ICON}<span>${text}</span>`;
      const APP_NAME = "CREDTANK";
      const AUTH_PANEL_BY_ROLE = {
        admin: "corporativo",
        empresa: "corporativo",
        colaborador: "colaborador",
        funcionario: "colaborador",
        maquininha: "maquininha",
        posto: "corporativo",
      };
      const AUTH_PANEL_LABELS = {
        corporativo: "Acesso corporativo",
        colaborador: "Acesso colaborador",
        maquininha: "Acesso maquininha",
      };
      const REPORT_EXPORT_MAP = {
        extrato: {
          id: "relatorio-extrato",
          title: "Extrato",
          label: "Extrato do colaborador",
          roles: ["admin", "empresa", "funcionario"],
        },
        empresa: {
          id: "relatorio-empresa",
          title: "Relatório Empresa",
          label: "Relatório da empresa",
          roles: ["admin", "empresa"],
        },
        folha: {
          id: "relatorio-folha",
          title: "Desconto em folha",
          label: "Desconto em folha",
          roles: ["admin", "empresa"],
        },
        repasse: {
          id: "relatorio-repasse",
          title: "Contas a receber do posto",
          label: "Contas a receber do posto",
          roles: ["admin", "empresa", "posto"],
        },
      };

      function fillSelect(select, items, labelFn, selectedValue = "") {
        select.innerHTML = "";
        items.forEach((item) => {
          const option = document.createElement("option");
          option.value = item.id;
          option.textContent = labelFn(item);
          if (selectedValue && selectedValue === item.id) {
            option.selected = true;
          }
          select.appendChild(option);
        });
      }

      function fillSelectWithAll(select, items, labelFn, selectedValue = "all") {
        select.innerHTML = "";
        const allOption = document.createElement("option");
        allOption.value = "all";
        allOption.textContent = "Todos";
        select.appendChild(allOption);
        items.forEach((item) => {
          const option = document.createElement("option");
          option.value = item.id;
          option.textContent = labelFn(item);
          if (selectedValue && selectedValue === item.id) {
            option.selected = true;
          }
          select.appendChild(option);
        });
        if (selectedValue === "all") {
          select.value = "all";
        }
      }

      function getCurrentFuncionarioId() {
        if (isColaboradorRole(currentUser?.role) && currentUser?.funcionarioId) {
          return currentUser.funcionarioId;
        }
        return elements.funcionarioSelect ? elements.funcionarioSelect.value : "";
      }

      function getFuncionario(id) {
        return state.funcionarios.find((f) => f.id === id);
      }

      function getEmpresaConvenioIds(empresaId) {
        const empresa = getEmpresa(empresaId);
        if (!empresa) return null;
        if (!Array.isArray(empresa.postosConvenio)) return null;
        return empresa.postosConvenio.filter((id) => id);
      }

      function getPostosByConvenio(empresaId) {
        const ids = getEmpresaConvenioIds(empresaId);
        if (ids === null) return state.postos.slice();
        const allowed = new Set(ids);
        return state.postos.filter((posto) => allowed.has(posto.id));
      }

      function getEmpresaIdForUser() {
        if (currentUser?.role === "empresa") return currentUser.empresaId || null;
        if (isColaboradorRole(currentUser?.role)) {
          const funcionario = getFuncionario(currentUser.funcionarioId);
          return funcionario?.empresaId || null;
        }
        return null;
      }

      function getScopedPostos() {
        const empresaId = getEmpresaIdForUser();
        if (!empresaId) return state.postos;
        return getPostosByConvenio(empresaId);
      }

      function filterTransacoesByConvenio(transacoes, empresaId) {
        if (!empresaId) return transacoes;
        const ids = getEmpresaConvenioIds(empresaId);
        if (ids === null) return transacoes;
        if (!ids.length) return transacoes;
        const allowed = new Set(ids);
        return transacoes.filter((tx) => allowed.has(tx.postoId));
      }

      function getEmpresa(id) {
        return state.empresas.find((e) => e.id === id);
      }

      function getPosto(id) {
        return state.postos.find((p) => p.id === id);
      }

      function normalizeCityLabel(value, fallback = "Cidade não informada") {
        const raw = String(value || "").trim().replace(/\s+/g, " ");
        return raw || fallback;
      }

      function getPostoCidade(posto) {
        return normalizeCityLabel(posto?.cidade);
      }

      function getFuncionarioCidade(funcionario) {
        return normalizeCityLabel(funcionario?.cidade || funcionario?.localidade);
      }

      function getFuncionarioContrato(funcionario) {
        const raw = String(funcionario?.contrato || "").trim();
        return raw || "Sem contrato";
      }

      function getPostoUser() {
        if (!currentUser || currentUser.role !== "posto") return null;
        return getPosto(currentUser.postoId);
      }

      function normalizeCodigo(value) {
        return String(value || "").trim().toUpperCase();
      }

      function maskAccessCode(value) {
        const trimmed = String(value || "").trim();
        if (!trimmed) return "--";
        if (trimmed.length <= 2) return "*".repeat(trimmed.length);
        return `${"*".repeat(trimmed.length - 2)}${trimmed.slice(-2)}`;
      }

      function getPostoByCodigo(codigo) {
        const normalized = normalizeCodigo(codigo);
        if (!normalized) return null;
        return state.postos.find((posto) => {
          const code = normalizeCodigo(posto.codigoMaquininha);
          const id = normalizeCodigo(posto.id);
          return code === normalized || id === normalized;
        });
      }

      function isCodigoMaquininhaDuplicado(codigo, ignoreId = "") {
        const normalized = normalizeCodigo(codigo);
        if (!normalized) return false;
        return state.postos.some((posto) => {
          if (ignoreId && posto.id === ignoreId) return false;
          const code = normalizeCodigo(posto.codigoMaquininha);
          const id = normalizeCodigo(posto.id);
          return code === normalized || id === normalized;
        });
      }

      function generateUniqueCodigoMaquininha() {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
          const timePart = Date.now().toString(36).slice(-4).toUpperCase();
          const codigo = `MQ-${timePart}${randomPart}`;
          if (!isCodigoMaquininhaDuplicado(codigo)) return codigo;
        }
        return `MQ-${Date.now().toString(36).toUpperCase()}`;
      }

      function normalizeCoordToken(value) {
        if (value === null || value === undefined) return null;
        const raw = String(value).trim();
        if (!raw) return null;
        let normalized = raw;
        const hasComma = raw.includes(",");
        const hasDot = raw.includes(".");
        if (hasComma && hasDot) {
          const lastComma = raw.lastIndexOf(",");
          const lastDot = raw.lastIndexOf(".");
          if (lastComma > lastDot) {
            normalized = raw.replace(/\./g, "").replace(",", ".");
          } else {
            normalized = raw.replace(/,/g, "");
          }
        } else if (hasComma) {
          normalized = raw.replace(",", ".");
        }
        const num = Number(normalized);
        return Number.isFinite(num) ? num : null;
      }

      function parseCoordinates(value) {
        if (!value) return null;
        const match = String(value).match(/(-?\d+(?:[.,]\d+)?)[^\d-]+(-?\d+(?:[.,]\d+)?)/);
        if (!match) return null;
        const hasSignal =
          /[.,]/.test(match[1]) || /[.,]/.test(match[2]) || /-/.test(match[1]) || /-/.test(match[2]);
        if (!hasSignal) return null;
        const lat = normalizeCoordToken(match[1]);
        const lng = normalizeCoordToken(match[2]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        return { lat, lng };
      }

      function isLikelyUrl(value) {
        return /^https?:\/\//i.test(String(value).trim());
      }

      function toValidCoords(latValue, lngValue) {
        const lat = normalizeCoordToken(latValue);
        const lng = normalizeCoordToken(lngValue);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
        return { lat, lng };
      }

      function extractCoordinatesFromMapsLink(url) {
        if (!url) return null;
        let text = String(url);
        try {
          text = decodeURIComponent(text);
        } catch (error) {
          // Ignora erro de decode e tenta extrair mesmo assim.
        }
        const patterns = [
          /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
          /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
          /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
          /[?&]query=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
          /[?&]destination=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
          /[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        ];
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            const coords = toValidCoords(match[1], match[2]);
            if (coords) return coords;
          }
        }
        return null;
      }

      function getCoordinatesFromLocalizacao(localizacao) {
        if (!localizacao) return null;
        if (isLikelyUrl(localizacao)) {
          return extractCoordinatesFromMapsLink(localizacao);
        }
        return parseCoordinates(localizacao);
      }

      function resolvePostoCoords(posto) {
        if (!posto) return null;
        if (Number.isFinite(posto.lat) && Number.isFinite(posto.lng)) {
          return { lat: posto.lat, lng: posto.lng };
        }
        const coords = getCoordinatesFromLocalizacao(posto.localizacao);
        if (coords) {
          posto.lat = coords.lat;
          posto.lng = coords.lng;
          return coords;
        }
        return null;
      }

      function formatPostoLocalizacao(posto) {
        resolvePostoCoords(posto);
        if (posto?.localizacao) {
          if (isLikelyUrl(posto.localizacao)) {
            if (Number.isFinite(posto?.lat) && Number.isFinite(posto?.lng)) {
              return `Link do Maps (${posto.lat.toFixed(5)}, ${posto.lng.toFixed(5)})`;
            }
            return "Link do Maps";
          }
          const coordsFromLocal = parseCoordinates(posto.localizacao);
          if (
            coordsFromLocal &&
            Number.isFinite(posto?.lat) &&
            Number.isFinite(posto?.lng) &&
            Math.abs(coordsFromLocal.lat - posto.lat) < 0.0001 &&
            Math.abs(coordsFromLocal.lng - posto.lng) < 0.0001
          ) {
            return posto.localizacao;
          }
          if (Number.isFinite(posto?.lat) && Number.isFinite(posto?.lng)) {
            return `${posto.localizacao} (${posto.lat.toFixed(5)}, ${posto.lng.toFixed(5)})`;
          }
          return posto.localizacao;
        }
        if (Number.isFinite(posto?.lat) && Number.isFinite(posto?.lng)) {
          return `${posto.lat.toFixed(5)}, ${posto.lng.toFixed(5)}`;
        }
        return "--";
      }

      function isFuncionarioAtivo(funcionario) {
        return funcionario?.ativo !== false;
      }

      function normalizePaymentSource(value) {
        const source = String(value || "").toLowerCase();
        if (source === "credito") return "credito";
        return "indefinido";
      }

      function paymentSourceLabel(value) {
        const source = normalizePaymentSource(value);
        if (source === "credito") return "Credito normal";
        return "Indefinido";
      }

      function funcionarioStatusLabel(funcionario) {
        return isFuncionarioAtivo(funcionario) ? "Ativo" : "Inativo";
      }

      function funcionarioLabel(funcionario) {
        const status = isFuncionarioAtivo(funcionario) ? "" : " - Inativo";
        return `${funcionario.nome} (${funcionario.matricula})${status}`;
      }

      function formatDistanceKm(value) {
        if (!Number.isFinite(value)) return "--";
        return `${value.toFixed(1)} km`;
      }

      function haversineDistance(lat1, lng1, lat2, lng2) {
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371 * c;
      }

      function buildMapsUrl(posto, origin) {
        if (!posto) return "";
        const coords = resolvePostoCoords(posto);
        const destinationFallback =
          posto.localizacao && !isLikelyUrl(posto.localizacao) ? posto.localizacao : posto.nome || "";
        const destination = coords ? `${coords.lat},${coords.lng}` : destinationFallback;
        const hasAccurateOrigin =
          origin &&
          Number.isFinite(origin.lat) &&
          Number.isFinite(origin.lng) &&
          (!Number.isFinite(origin.accuracy) || origin.accuracy <= MAPS_ACCURACY_LIMIT);
        if (hasAccurateOrigin && destination) {
          const encodedOrigin = encodeURIComponent(`${origin.lat},${origin.lng}`);
          const encodedDestination = encodeURIComponent(destination);
          return `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}`;
        }
        if (isLikelyUrl(posto.localizacao)) {
          return posto.localizacao;
        }
        if (!destination) return "";
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
      }

      function buildMapsUrlFromLocation(localizacao) {
        if (!localizacao) return "https://www.google.com/maps";
        if (isLikelyUrl(localizacao)) return localizacao;
        const coords = parseCoordinates(localizacao);
        if (coords) {
          return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${coords.lat},${coords.lng}`
          )}`;
        }
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(localizacao)}`;
      }

      function setNearestStatus(text, type) {
        elements.postoNearestStatus.textContent = text;
        elements.postoNearestStatus.className = `status ${type}`;
      }

      function findNearestPosto(lat, lng) {
        const candidatos = getScopedPostos()
          .map((posto) => {
            const coords = resolvePostoCoords(posto);
            return coords ? { posto, coords } : null;
          })
          .filter(Boolean);
        if (!candidatos.length) return null;
        let nearest = null;
        let nearestDistance = Infinity;
        candidatos.forEach((entry) => {
          const distance = haversineDistance(lat, lng, entry.coords.lat, entry.coords.lng);
          if (distance < nearestDistance) {
            nearest = entry.posto;
            nearestDistance = distance;
          }
        });
        if (!nearest) return null;
        return { posto: nearest, distanceKm: nearestDistance };
      }

      function getUsuarioByEmail(email) {
        const matches = getUsuariosByEmail(email);
        return matches.length === 1 ? matches[0] : null;
      }

      function getUsuarioByEmailInsensitive(email) {
        return getUsuarioByEmail(email);
      }

      function getUsuariosByEmail(email) {
        const normalized = String(email || "").trim().toLowerCase();
        if (!normalized) return [];
        return state.usuarios.filter(
          (u) => String(u.email || "").trim().toLowerCase() === normalized
        );
      }

      function getEmpresaUser(empresaId) {
        return state.usuarios.find((u) => u.role === "empresa" && u.empresaId === empresaId);
      }

      function getPostoUserById(postoId) {
        return state.usuarios.find((u) => u.role === "posto" && u.postoId === postoId);
      }

      function rebindCurrentUserFromState() {
        if (!currentUser) return;
        if (isColaboradorRole(currentUser.role)) return;
        if (currentUser.id) {
          const byId = state.usuarios.find((entry) => entry.id === currentUser.id);
          if (byId) {
            currentUser = byId;
            return;
          }
        }
        if (currentUser.email) {
          const byEmail = getUsuarioByEmailInsensitive(currentUser.email);
          if (byEmail) {
            currentUser = byEmail;
          }
        }
      }

      function mergeTerms(targetList, localList) {
        if (!Array.isArray(targetList) || !Array.isArray(localList)) return;
        localList.forEach((local) => {
          if (!local?.termsAcceptedAt) return;
          const target = targetList.find((item) => item.id === local.id);
          if (!target) return;
          if (!target.termsAcceptedAt) {
            target.termsAcceptedAt = local.termsAcceptedAt;
            if (local.termsName) {
              target.termsName = local.termsName;
            }
          }
        });
      }

      function mergeById(existing, incoming) {
        const base = Array.isArray(existing) ? existing : [];
        const extra = Array.isArray(incoming) ? incoming : [];
        const map = new Map();
        base.forEach((item) => {
          if (item && item.id) {
            map.set(item.id, item);
          }
        });
        extra.forEach((item) => {
          if (item && item.id) {
            map.set(item.id, item);
          }
        });
        return Array.from(map.values());
      }

      function normalizeMatricula(value) {
        if (value === null || value === undefined) return "";
        return String(value).replace(/\D/g, "");
      }

      function normalizeCpf(value) {
        if (value === null || value === undefined) return "";
        return String(value).replace(/\D/g, "");
      }

      function normalizeTelefone(value) {
        if (value === null || value === undefined) return "";
        return String(value).replace(/\D/g, "");
      }

      function formatCpfInput(value) {
        const digits = normalizeCpf(value).slice(0, 11);
        if (!digits) return "";
        return digits
          .replace(/^(\d{3})(\d)/, "$1.$2")
          .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
      }

      function formatTelefoneInput(value) {
        const digits = normalizeTelefone(value).slice(0, 11);
        if (!digits) return "";
        if (digits.length <= 2) return `(${digits}`;
        if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
      }

      function formatCnpjInput(value) {
        const digits = String(value || "").replace(/\D/g, "").slice(0, 14);
        if (!digits) return "";
        return digits
          .replace(/^(\d{2})(\d)/, "$1.$2")
          .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
          .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
      }

      function formatDigitsInput(value, maxLength) {
        const digits = String(value || "").replace(/\D/g, "");
        if (!Number.isFinite(maxLength) || maxLength <= 0) return digits;
        return digits.slice(0, maxLength);
      }

      function accessPasswordRuleError(value) {
        const senha = String(value || "");
        if (senha.length < 6) {
          return "A senha deve ter no minimo 6 caracteres.";
        }
        return "";
      }

      function isAccessPasswordStrong(value) {
        return accessPasswordRuleError(value) === "";
      }

      function bindInputMask(input, formatter) {
        if (!input || typeof formatter !== "function") return;
        const apply = () => {
          input.value = formatter(input.value);
        };
        input.addEventListener("input", apply);
        apply();
      }

      function setupInputMasks() {
        const cpfInputs = [
          elements.colabCpf,
          elements.colabForgotCpf,
          elements.empresaFuncCpf,
          elements.funcCpfInput,
          elements.funcModalCpf,
        ];
        cpfInputs.forEach((input) => bindInputMask(input, formatCpfInput));

        const phoneInputs = [
          elements.colabTelefone,
          elements.empresaFuncTelefone,
          elements.funcTelefoneInput,
          elements.funcModalTelefone,
        ];
        phoneInputs.forEach((input) => bindInputMask(input, formatTelefoneInput));

        const cnpjInputs = [
          elements.empresaCnpjInput,
          elements.empresaSelfCnpj,
          elements.postoCnpjInput,
          elements.empresaModalCnpj,
          elements.postoModalCnpj,
        ];
        cnpjInputs.forEach((input) => bindInputMask(input, formatCnpjInput));

        const salarioInputs = [elements.empresaFuncSalario, elements.funcSalarioInput, elements.funcModalSalario];
        salarioInputs.forEach((input) => bindInputMask(input, formatCurrencyInput));

        const matriculaInputs = [elements.empresaFuncMatricula, elements.funcMatriculaInput, elements.funcModalMatricula];
        matriculaInputs.forEach((input) => bindInputMask(input, (value) => formatDigitsInput(value, 20)));

        const pin4Inputs = [
          elements.colabTxPin,
          elements.colabTxPinConfirm,
          elements.empresaFuncTxPin,
          elements.funcTxPinInput,
          elements.txPinCurrent,
          elements.txPinNew,
          elements.txPinConfirm,
          elements.txConfirmPassword,
        ];
        pin4Inputs.forEach((input) => bindInputMask(input, (value) => formatDigitsInput(value, 4)));

        const code6Inputs = [elements.colabEmailCode, elements.txPinCode];
        code6Inputs.forEach((input) => bindInputMask(input, (value) => formatDigitsInput(value, 6)));
      }

      function maskEmail(email) {
        const normalized = normalizeEmail(email);
        if (!normalized.includes("@")) return "--";
        const [localRaw, domainRaw] = normalized.split("@");
        if (!localRaw || !domainRaw) return "--";
        const domainParts = domainRaw.split(".");
        const domainMain = domainParts.shift() || "";
        const domainSuffix = domainParts.length ? `.${domainParts.join(".")}` : "";
        const localPrefix = localRaw.slice(0, Math.min(2, localRaw.length));
        const localMask = "*".repeat(Math.max(1, localRaw.length - localPrefix.length));
        const domainPrefix = domainMain.slice(0, Math.min(2, domainMain.length));
        const domainMask = "*".repeat(Math.max(1, domainMain.length - domainPrefix.length));
        return `${localPrefix}${localMask}@${domainPrefix}${domainMask}${domainSuffix}`;
      }

      function maskPhone(phone) {
        const digits = normalizeTelefone(phone);
        if (!digits) return "--";
        if (digits.length <= 4) return "*".repeat(digits.length);
        const prefix = digits.slice(0, Math.min(2, digits.length - 2));
        const suffix = digits.slice(-2);
        return `${prefix}${"*".repeat(Math.max(2, digits.length - 4))}${suffix}`;
      }

      function generateEmailCode() {
        return String(Math.floor(100000 + Math.random() * 900000));
      }

      function parseSalario(value) {
        if (typeof value === "number") {
          return Number.isFinite(value) ? value : 0;
        }
        return parseCurrencyInput(String(value || "").trim());
      }

      function formatSalarioInput(value) {
        const parsed = parseSalario(value);
        if (!parsed || parsed <= 0) return "";
        return formatCurrencyInput(Math.round(parsed * 100));
      }

      function getEmpresaLimiteConfig(empresa) {
        const tipo = empresa?.limiteTipo === "fixo" ? "fixo" : "percentual";
        const valorFixoRaw = Number(empresa?.limiteValorFixo);
        const valorLegado = Number(empresa?.limiteMensal);
        const valorFixo = Number.isFinite(valorFixoRaw) && valorFixoRaw >= 0
          ? valorFixoRaw
          : Number.isFinite(valorLegado) && valorLegado >= 0
            ? valorLegado
            : state.limitePadrao;
        return {
          tipo,
          percentual: 30,
          teto: LIMITE_MAXIMO_CREDITO,
          valorFixo,
        };
      }

      function calcularLimitePorSalario(salario, empresa = null) {
        const config = getEmpresaLimiteConfig(empresa);
        if (config.tipo === "fixo") {
          return Math.max(0, Math.round(config.valorFixo * 100) / 100);
        }
        if (!Number.isFinite(salario) || salario <= 0) return 0;
        const limiteCalculado = Math.round(salario * (config.percentual / 100) * 100) / 100;
        return Math.min(config.teto, limiteCalculado);
      }

      function descricaoLimiteEmpresa(empresa) {
        const config = getEmpresaLimiteConfig(empresa);
        if (config.tipo === "fixo") {
          return `Valor fixo de ${formatBRL(config.valorFixo)} por colaborador`;
        }
        return `30% do salario, maximo de ${formatBRL(config.teto)} por colaborador`;
      }

      function parseFechamentoDia(value) {
        const match = String(value || "").match(/(\d{1,2})/);
        if (!match) return 30;
        const day = Number(match[1]);
        if (!Number.isFinite(day)) return 30;
        if (day < 1) return 1;
        if (day > 31) return 31;
        return day;
      }

      function normalizeFechamento(value) {
        const day = parseFechamentoDia(value);
        return `Dia ${day}`;
      }

      function clampFechamentoDay(day, year, month) {
        const lastDay = new Date(year, month + 1, 0).getDate();
        return Math.min(day, lastDay);
      }

      function buildFechamentoDate(day, referenceDate) {
        const year = referenceDate.getFullYear();
        const month = referenceDate.getMonth();
        const safeDay = clampFechamentoDay(day, year, month);
        return new Date(year, month, safeDay, 0, 0, 0, 0);
      }

      function getEmpresaPeriodoInicio(empresa, referenceDate = new Date()) {
        if (!empresa) return null;
        const day = parseFechamentoDia(empresa.fechamento);
        const atual = buildFechamentoDate(day, referenceDate);
        if (referenceDate >= atual) {
          return atual;
        }
        const prevMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
        return buildFechamentoDate(day, prevMonth);
      }

      function getProximaRecomposicaoSaldo(empresa, referenceDate = new Date()) {
        if (!empresa) return null;
        const day = parseFechamentoDia(empresa.fechamento);
        let next = buildFechamentoDate(day, referenceDate);
        if (next <= referenceDate) {
          const nextMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
          next = buildFechamentoDate(day, nextMonth);
        }
        return next;
      }

      function formatDataLongaBR(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "--";
        return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      }

      function getFuncionarioByMatricula(matricula) {
        const normalized = normalizeMatricula(matricula);
        return state.funcionarios.find((f) => normalizeMatricula(f.matricula) === normalized);
      }

      function getFuncionarioByCpf(cpf) {
        const normalized = normalizeCpf(cpf);
        return state.funcionarios.find((f) => normalizeCpf(f.cpf) === normalized);
      }

      function getColaboradorAuthByCpf(cpf) {
        const normalized = normalizeCpf(cpf);
        return state.colaboradoresAuth.find((c) => normalizeCpf(c.cpf) === normalized);
      }

      function getColaboradorAuthByFuncionarioId(funcionarioId) {
        return state.colaboradoresAuth.find((c) => c.funcionarioId === funcionarioId);
      }

      function updateColaboradorAuthCpf(funcionarioId, cpf) {
        const normalized = normalizeCpf(cpf) || cpf;
        state.colaboradoresAuth.forEach((auth) => {
          if (auth.funcionarioId === funcionarioId) {
            auth.cpf = normalized;
          }
        });
      }

      function removeColaboradorAuthByFuncionario(funcionarioId) {
        state.colaboradoresAuth = state.colaboradoresAuth.filter((auth) => auth.funcionarioId !== funcionarioId);
      }

      function buildColaboradorUser(auth) {
        const funcionario = getFuncionario(auth.funcionarioId);
        return {
          id: auth.id,
          nome: funcionario?.nome || "Colaborador",
          role: "funcionario",
          funcionarioId: auth.funcionarioId,
        };
      }

      function generateId(prefix) {
        return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
      }

      function logEvent(action, detail) {
        state.logs.unshift({
          id: generateId("LOG"),
          action,
          detail,
          timestamp: new Date(),
        });
      }

      function limiteEmpresa(empresaId) {
        const empresa = getEmpresa(empresaId);
        const config = getEmpresaLimiteConfig(empresa);
        return config.tipo === "fixo" ? config.valorFixo : config.teto;
      }

      function limiteFuncionario(funcionarioId) {
        const funcionario = getFuncionario(funcionarioId);
        if (!funcionario) return 0;
        const empresa = getEmpresa(funcionario.empresaId);
        const config = getEmpresaLimiteConfig(empresa);
        if (config.tipo === "fixo") {
          return calcularLimitePorSalario(0, empresa);
        }
        const salario = parseSalario(funcionario.salario);
        return calcularLimitePorSalario(salario, empresa);
      }

      function gastoFuncionario(funcionarioId) {
        const funcionario = getFuncionario(funcionarioId);
        const empresa = funcionario ? getEmpresa(funcionario.empresaId) : null;
        const periodoInicio = getEmpresaPeriodoInicio(empresa);
        return state.transacoes
          .filter((tx) => {
            if (tx.funcionarioId !== funcionarioId) return false;
            if (!isTxConfirmed(tx)) return false;
            if (normalizePaymentSource(tx.paymentSource || tx.payment_source) !== "credito") return false;
            if (periodoInicio && tx.timestamp < periodoInicio) return false;
            return true;
          })
          .reduce((sum, tx) => sum + tx.valor, 0);
      }

      function saldoFuncionario(funcionarioId) {
        return Math.max(0, limiteFuncionario(funcionarioId) - gastoFuncionario(funcionarioId));
      }

      function formatDisplayName(name) {
        const clean = String(name || "").trim();
        if (!clean) return "Usuario";
        const parts = clean.split(/\s+/).filter(Boolean);
        if (parts.length <= 1) return parts[0];
        return `${parts[0]} ${parts[parts.length - 1]}`;
      }

      function setBankUserName(name) {
        const value = formatDisplayName(name);
        document.querySelectorAll(".bank-user-name").forEach((el) => {
          el.textContent = value;
        });
      }

      let mobileEntryTimer = null;

      function isTouchMobileViewport() {
        const userAgent = navigator.userAgent || "";
        const mobileUa = /Android|iPhone|iPad|iPod|Mobile|wv/i.test(userAgent);
        if (!window.matchMedia) return mobileUa;
        const compactViewport = window.matchMedia("(max-width: 900px)").matches;
        if (!compactViewport) return false;
        const coarsePointer =
          window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(any-pointer: coarse)").matches;
        const noHover =
          window.matchMedia("(hover: none)").matches || window.matchMedia("(any-hover: none)").matches;
        return coarsePointer || noHover || mobileUa;
      }

      function shouldEnforceSessionReauth() {
        // Regra solicitada: timeout apenas na versao mobile, em todos os perfis.
        return isTouchMobileViewport() || IS_ANDROID_WEBVIEW_APP;
      }

      function runMobileEntryAnimation() {
        document.body.classList.remove("mobile-entry-ready");
        const isFuncionarioRole = currentUser?.role === "funcionario" || currentUser?.role === "colaborador";
        if (!isFuncionarioRole || !isTouchMobileViewport()) {
          document.body.classList.remove("mobile-entry-running");
          if (mobileEntryTimer) {
            clearTimeout(mobileEntryTimer);
            mobileEntryTimer = null;
          }
          return;
        }
        document.body.classList.add("mobile-entry-running");
        if (mobileEntryTimer) {
          clearTimeout(mobileEntryTimer);
        }
        mobileEntryTimer = setTimeout(() => {
          document.body.classList.add("mobile-entry-ready");
        }, 44);
      }

      function canUseNativeBridge() {
        return IS_ANDROID_WEBVIEW_APP && typeof window !== "undefined" && !!window.CredTankNative;
      }

      function isColaboradorRole(role = currentUser?.role) {
        return role === "funcionario" || role === "colaborador";
      }

      function parseNativeBridgePayload(payload) {
        if (payload && typeof payload === "object") return payload;
        if (typeof payload === "string") {
          try {
            const parsed = JSON.parse(payload);
            if (parsed && typeof parsed === "object") return parsed;
          } catch (error) {
          }
        }
        return { ok: !!payload };
      }

      if (typeof window !== "undefined" && typeof window.__credtankNativeResolve !== "function") {
        window.__credtankNativeResolve = (callbackId, payload) => {
          const key = String(callbackId || "");
          if (!key) return;
          const pending = nativeBridgeCallbacks.get(key);
          if (!pending) return;
          nativeBridgeCallbacks.delete(key);
          clearTimeout(pending.timer);
          pending.resolve(parseNativeBridgePayload(payload));
        };
      }

      function callNativeBridgeAsync(methodName, ...args) {
        if (!canUseNativeBridge()) {
          return Promise.resolve({ ok: false, code: "native_unavailable" });
        }
        const bridge = window.CredTankNative;
        const method = bridge ? bridge[methodName] : null;
        if (typeof method !== "function") {
          return Promise.resolve({ ok: false, code: "native_method_unavailable" });
        }
        const callbackId = `native_${Date.now()}_${nativeBridgeCallbackSeq++}`;
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            if (nativeBridgeCallbacks.delete(callbackId)) {
              resolve({ ok: false, code: "native_timeout" });
            }
          }, 16000);
          nativeBridgeCallbacks.set(callbackId, { resolve, timer });
          try {
            method.call(
              bridge,
              callbackId,
              ...args.map((value) => String(value == null ? "" : value))
            );
          } catch (error) {
            clearTimeout(timer);
            nativeBridgeCallbacks.delete(callbackId);
            resolve({ ok: false, code: "native_call_error" });
          }
        });
      }

      function readNativeBridgeBoolean(methodName) {
        if (!canUseNativeBridge()) return false;
        const bridge = window.CredTankNative;
        const method = bridge ? bridge[methodName] : null;
        if (typeof method !== "function") return false;
        try {
          const value = method.call(bridge);
          return value === true || value === "true" || value === 1 || value === "1";
        } catch (error) {
          return false;
        }
      }

      function isNotificationAvailableOnDevice() {
        return "Notification" in window || canUseNativeBridge();
      }

      function isNativeNotificationPermissionGranted() {
        return readNativeBridgeBoolean("isNotificationPermissionGranted");
      }

      async function requestNativeNotificationPermission() {
        if (isNativeNotificationPermissionGranted()) return true;
        const result = await callNativeBridgeAsync("requestNotificationPermission");
        return !!result?.granted;
      }

      async function requestBrowserNotificationPermission() {
        if (!("Notification" in window)) return false;
        if (Notification.permission === "granted") return true;
        if (Notification.permission === "denied") return false;
        try {
          const permission = await Notification.requestPermission();
          return permission === "granted";
        } catch (error) {
          return false;
        }
      }

      async function ensureNotificationPermission() {
        const browserAllowed = await requestBrowserNotificationPermission();
        if (browserAllowed) return true;
        if (canUseNativeBridge()) {
          return requestNativeNotificationPermission();
        }
        return false;
      }

      async function showAppNotification(title, body, tag = "") {
        const safeTitle = String(title || APP_NAME).trim() || APP_NAME;
        const safeBody = String(body || "").trim();
        const safeTag = String(tag || "").trim();
        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(safeTitle, {
              body: safeBody,
              tag: safeTag || undefined,
              icon: "../assets/Logo.png",
              badge: "../icon-192.png",
              renotify: true,
            });
            return true;
          } catch (error) {
          }
        }
        if (canUseNativeBridge()) {
          const nativeResult = await callNativeBridgeAsync("showNotification", safeTitle, safeBody, safeTag);
          return !!nativeResult?.ok;
        }
        return false;
      }

      function shouldNotifyTransactions() {
        if (!isColaboradorRole()) return false;
        const auth = getCurrentColaboradorAuth();
        if (!auth) return false;
        return auth.notificacoesAtivas !== false;
      }

      async function notifyPendingTransaction(tx) {
        if (!tx || !tx.id) return;
        if (!shouldNotifyTransactions()) return;
        if (lastNotifiedPendingTxId === tx.id) return;
        if (activeConfirmTxId === tx.id && elements.txConfirmModal && !elements.txConfirmModal.classList.contains("hidden")) {
          return;
        }
        const posto = getPosto(tx.postoId);
        const sent = await showAppNotification(
          "Nova transacao pendente",
          `${formatBRL(tx.valor)} em ${posto?.nome || "posto"} aguardando confirmacao.`,
          `tx_pending_${tx.id}`
        );
        if (sent) {
          lastNotifiedPendingTxId = tx.id;
        }
      }

      let balanceHidden = false;
      let lastBalanceValue = formatBRL(0);

      function getCurrentColaboradorAuth() {
        if (!isColaboradorRole() || !currentUser?.funcionarioId) return null;
        return getColaboradorAuthByFuncionarioId(currentUser.funcionarioId);
      }

      function getColaboradorSettings(auth = getCurrentColaboradorAuth()) {
        return {
          saldoVisivel: auth ? auth.saldoVisivel !== false : true,
          notificacoesAtivas: auth ? auth.notificacoesAtivas !== false : true,
        };
      }

      function saveColaboradorSettings(patch) {
        const auth = getCurrentColaboradorAuth();
        if (!auth || !patch || typeof patch !== "object") return false;
        Object.assign(auth, patch);
        queueStateSave(true);
        return true;
      }

      function updateBalanceToggleUi() {
        document.body.classList.toggle("balance-hidden", balanceHidden);
        document.querySelectorAll(".balance-toggle").forEach((button) => {
          const label = balanceHidden ? "Mostrar saldo" : "Ocultar saldo";
          button.setAttribute("aria-pressed", balanceHidden ? "true" : "false");
          button.setAttribute("aria-label", label);
          button.title = label;
        });
        if (elements.balanceVisibilityToggle) {
          elements.balanceVisibilityToggle.checked = !balanceHidden;
        }
      }

      function updateBalanceDisplay(value) {
        const formatted = value || lastBalanceValue || formatBRL(0);
        lastBalanceValue = formatted;
        const display = balanceHidden ? "R$ ****" : formatted;
        if (elements.kpiBalance) {
          elements.kpiBalance.textContent = display;
        }
        if (elements.kpiBalanceHome) {
          elements.kpiBalanceHome.textContent = display;
        }
        updateBalanceToggleUi();
      }

      function setBalanceVisibility(hidden, persist = false) {
        balanceHidden = !!hidden;
        updateBalanceDisplay(lastBalanceValue);
        if (!persist) return true;
        return saveColaboradorSettings({ saldoVisivel: !balanceHidden });
      }

      function toggleBalanceVisibility() {
        setBalanceVisibility(!balanceHidden, isColaboradorRole());
      }

      function handleBalanceVisibilityToggle() {
        if (!elements.balanceVisibilityToggle) return;
        const isFuncionario = isColaboradorRole();
        if (!isFuncionario) {
          elements.balanceVisibilityToggle.checked = !balanceHidden;
          return;
        }
        const visible = !!elements.balanceVisibilityToggle.checked;
        const saved = setBalanceVisibility(!visible, true);
        if (!saved) {
          setSettingsMessage("Cadastro de acesso nao encontrado.", "bad");
          return;
        }
        setSettingsMessage(visible ? "Saldo visivel ativado." : "Saldo oculto ativado.", visible ? "ok" : "muted");
      }

      async function handleNotifyToggle() {
        if (!elements.notifyToggle) return;
        const isFuncionario = isColaboradorRole();
        if (!isFuncionario) {
          elements.notifyToggle.checked = true;
          return;
        }
        const enabled = !!elements.notifyToggle.checked;
        if (enabled && !isNotificationAvailableOnDevice()) {
          elements.notifyToggle.checked = false;
          saveColaboradorSettings({ notificacoesAtivas: false });
          setSettingsMessage("Notificacoes indisponiveis neste dispositivo.", "bad");
          return;
        }
        if (enabled) {
          setSettingsMessage("Solicitando permissao de notificacoes...", "warn");
          const granted = await ensureNotificationPermission();
          if (!granted) {
            elements.notifyToggle.checked = false;
            saveColaboradorSettings({ notificacoesAtivas: false });
            if (canUseNativeBridge()) {
              callNativeBridgeAsync("openNotificationSettings");
              setSettingsMessage("Ative as notificacoes no Android e volte ao app.", "warn");
            } else {
              setSettingsMessage("Permissao de notificacoes negada.", "bad");
            }
            return;
          }
        }
        const saved = saveColaboradorSettings({ notificacoesAtivas: enabled });
        if (!saved) {
          setSettingsMessage("Cadastro de acesso nao encontrado.", "bad");
          return;
        }
        if (enabled) {
          showAppNotification(
            "Notificacoes ativadas",
            "Voce recebera alertas de novas transacoes.",
            "tx_notify_enabled"
          );
        }
        setSettingsMessage(
          enabled ? "Notificacoes de transacao ativadas." : "Notificacoes de transacao desativadas.",
          enabled ? "ok" : "muted"
        );
      }

      async function bootstrapNotificationPermissionForCurrentUser() {
        if (notificationBootstrapRequested) return;
        if (!isColaboradorRole()) return;
        const auth = getCurrentColaboradorAuth();
        if (!auth || auth.notificacoesAtivas === false) return;
        if (!isNotificationAvailableOnDevice()) return;
        const browserGranted = "Notification" in window && Notification.permission === "granted";
        const nativeGranted = canUseNativeBridge() && isNativeNotificationPermissionGranted();
        if (browserGranted || nativeGranted) return;
        notificationBootstrapRequested = true;
        try {
          await ensureNotificationPermission();
        } catch (error) {
        }
      }

      function updateProfileInfo() {
        if (!elements.profileNome) return;
        const funcionarioId = getCurrentFuncionarioId();
        const funcionario = funcionarioId ? getFuncionario(funcionarioId) : null;
        const empresa = funcionario ? getEmpresa(funcionario.empresaId) : null;
        const statusText = funcionario ? funcionarioStatusLabel(funcionario) : "--";
        const salario = parseSalario(funcionario?.salario);
        const limite = funcionario ? limiteFuncionario(funcionario.id) : 0;
        const consumoMes = funcionario ? gastoFuncionario(funcionario.id) : 0;
        const saldoAtual = Math.max(0, limite - consumoMes);
        const utilizacao = limite > 0 ? Math.min(100, Math.round((consumoMes / limite) * 100)) : 0;
        elements.profileNome.textContent = funcionario?.nome || currentUser?.nome || "--";
        elements.profileCpf.textContent = funcionario?.cpf || "--";
        elements.profileMatricula.textContent = funcionario?.matricula || "--";
        elements.profileEmpresa.textContent = empresa?.nome || "--";
        elements.profileStatus.textContent = statusText;
        if (elements.profileStatusPill) {
          elements.profileStatusPill.textContent = `Status: ${statusText}`;
          elements.profileStatusPill.classList.remove("active", "inactive", "unknown");
          if (statusText === "Ativo") {
            elements.profileStatusPill.classList.add("active");
          } else if (statusText === "Inativo") {
            elements.profileStatusPill.classList.add("inactive");
          } else {
            elements.profileStatusPill.classList.add("unknown");
          }
        }
        if (elements.profileEmail) {
          elements.profileEmail.textContent = funcionario?.email || "--";
        }
        if (elements.profileTelefone) {
          const telefone = funcionario?.telefone ? formatTelefoneInput(funcionario.telefone) : "";
          elements.profileTelefone.textContent = telefone || "--";
        }
        if (elements.profileSalario) {
          elements.profileSalario.textContent = salario > 0 ? formatBRL(salario) : "--";
        }
        if (elements.profileLimite) {
          elements.profileLimite.textContent = formatBRL(limite);
        }
        if (elements.profileConsumoMes) {
          elements.profileConsumoMes.textContent = formatBRL(consumoMes);
        }
        if (elements.profileSaldo) {
          elements.profileSaldo.textContent = formatBRL(saldoAtual);
        }
        if (elements.profileUtilizacao) {
          elements.profileUtilizacao.textContent = `${utilizacao}%`;
        }
        if (elements.profileUtilizacaoFill) {
          elements.profileUtilizacaoFill.style.width = `${utilizacao}%`;
        }
        const foto = funcionario?.fotoData || "";
        const canEditFoto = isColaboradorRole(currentUser?.role) && !!funcionario;
        if (elements.profileFoto) {
          if (foto) {
            elements.profileFoto.src = foto;
            elements.profileFoto.classList.remove("hidden");
            if (elements.profileFotoPlaceholder) {
              elements.profileFotoPlaceholder.style.display = "none";
            }
          } else {
            elements.profileFoto.removeAttribute("src");
            elements.profileFoto.classList.add("hidden");
            if (elements.profileFotoPlaceholder) {
              elements.profileFotoPlaceholder.style.display = "";
            }
          }
        }
        if (elements.profileFotoInput) {
          elements.profileFotoInput.disabled = !canEditFoto;
        }
        if (elements.profilePhotoWarning) {
          elements.profilePhotoWarning.classList.toggle("hidden", !canEditFoto || !!foto);
        }
        if (elements.funcionarioFotoBanner) {
          elements.funcionarioFotoBanner.classList.toggle("hidden", !canEditFoto || !!foto);
        }
        if (elements.profileFotoMsg && !canEditFoto) {
          setMessage(elements.profileFotoMsg, "", "muted");
        }
      }

      function updateKpis() {
        const funcionarioId = getCurrentFuncionarioId();
        if (!funcionarioId) {
          if (elements.kpiLimit) {
            elements.kpiLimit.textContent = formatBRL(0);
          }
          updateBalanceDisplay(formatBRL(0));
          if (elements.kpiLimitHome) {
            elements.kpiLimitHome.textContent = formatBRL(0);
          }
          setBankUserName(currentUser?.nome || "Usuario");
          updateProfileInfo();
          return;
        }
        const limite = limiteFuncionario(funcionarioId);
        const saldo = saldoFuncionario(funcionarioId);
        const funcionario = getFuncionario(funcionarioId);
        if (elements.kpiLimit) {
          elements.kpiLimit.textContent = formatBRL(limite);
        }
        updateBalanceDisplay(formatBRL(saldo));
        if (elements.kpiLimitHome) {
          elements.kpiLimitHome.textContent = formatBRL(limite);
        }
        setBankUserName(funcionario?.nome || currentUser?.nome || "Usuario");
        updateProfileInfo();
      }

      function refreshAllViews() {
        if (!currentUser) return;
        if (currentUser.role !== "empresa" && viewingEmpresaFuncionarioId) {
          closeEmpresaFuncionarioProfile();
        }
        syncBiometriaToggle();
        syncColaboradorSettings();
        updateKpis();
        renderTransacoes();
        renderReports();
        renderAdmin();
        renderEmpresaDashboard();
        renderPostoDashboard();
        renderPostosList();
        maybePromptPendingConfirmation();
        if (elements.settingsMsg && isColaboradorRole(currentUser.role)) {
          const auth = getCurrentColaboradorAuth();
          const funcionario = currentUser?.funcionarioId ? getFuncionario(currentUser.funcionarioId) : null;
          const missingPhoto = !funcionario?.fotoData;
          if (missingPhoto) {
            setMessage(elements.settingsMsg, "Foto obrigatoria: envie sua foto na area de perfil.", "warn");
          } else if (!auth?.senhaTransacao) {
            setMessage(
              elements.settingsMsg,
              "Defina sua senha de transacao em Seguranca para aprovar operacoes.",
              "warn"
            );
          } else if (
            elements.settingsMsg.textContent.includes("senha de transacao") ||
            elements.settingsMsg.textContent.includes("Foto obrigatoria")
          ) {
            setMessage(elements.settingsMsg, "", "muted");
          }
          updateTxRevealBioAvailability(auth);
          updateTxPinCodeHint();
          if (elements.txRevealValue && elements.txRevealValue.value !== TX_REVEAL_MASK) {
            elements.txRevealValue.value = TX_REVEAL_MASK;
          }
        } else if (elements.txRevealValue) {
          elements.txRevealValue.value = TX_REVEAL_MASK;
          resetTxPinCodeState();
          updateTxPinCodeHint();
        }
      }

      function updateFuncionarioOptions() {
        const currentFuncionario = getCurrentFuncionarioId();
        const currentFuncionarioRecord = currentFuncionario ? getFuncionario(currentFuncionario) : null;
        const empresaId = currentFuncionarioRecord?.empresaId || elements.empresaSelect.value;
        const filtered = state.funcionarios.filter((f) => f.empresaId === empresaId && isFuncionarioAtivo(f));
        if (
          currentFuncionarioRecord &&
          currentFuncionarioRecord.empresaId === empresaId &&
          !filtered.some((f) => f.id === currentFuncionarioRecord.id)
        ) {
          filtered.unshift(currentFuncionarioRecord);
        }
        fillSelect(elements.funcionarioSelect, filtered, (f) => `${f.nome} (${f.matricula})`, currentFuncionario);
        if (currentFuncionarioRecord) {
          elements.funcionarioSelect.value = currentFuncionarioRecord.id;
        } else if (filtered.length && !filtered.find((f) => f.id === elements.funcionarioSelect.value)) {
          elements.funcionarioSelect.value = filtered[0].id;
        }
        updateKpis();
      }

      function getStoredMaquininhaCodigo() {
        try {
          return (
            sessionStorage.getItem("maquininhaCodigo") ||
            sessionStorage.getItem("maquininhaPostoId") ||
            ""
          );
        } catch (error) {
          return "";
        }
      }

      function getRememberPreference(type = "user") {
        const checkbox = type === "colab" ? elements.colabRememberCheck : elements.rememberCheck;
        return checkbox ? checkbox.checked : false;
      }

      function updateMaquininhaPreview(codigo) {
        if (!elements.maquininhaPostoNome) return null;
        const posto = getPostoByCodigo(codigo);
        elements.maquininhaPostoNome.value = posto ? posto.nome : "--";
        return posto;
      }

      function syncSelects() {
        const currentFuncionario =
          isColaboradorRole(currentUser?.role) && currentUser?.funcionarioId
            ? getFuncionario(currentUser.funcionarioId)
            : null;
        const empresaDefault =
          currentUser?.role === "empresa"
            ? currentUser.empresaId
            : currentFuncionario?.empresaId || elements.empresaSelect.value;
        const empresaId = empresaDefault || state.empresas[0]?.id;
        const scopedPostos = getScopedPostos();
        fillSelect(elements.empresaSelect, state.empresas, (e) => e.nome, empresaId);
        fillSelect(elements.funcEmpresaSelect, state.empresas, (e) => e.nome, elements.funcEmpresaSelect.value);
        const relatorioEmpresaId = currentUser?.role === "empresa" ? currentUser.empresaId : elements.relatorioEmpresaSelect.value || empresaId;
        fillSelect(elements.relatorioEmpresaSelect, state.empresas, (e) => e.nome, relatorioEmpresaId);
        if (elements.relatorioFolhaEmpresa) {
          fillSelect(elements.relatorioFolhaEmpresa, state.empresas, (e) => e.nome, relatorioEmpresaId);
        }
        if (elements.relatorioEmpresaPosto) {
          fillSelectWithAll(
            elements.relatorioEmpresaPosto,
            state.empresas,
            (e) => e.nome,
            elements.relatorioEmpresaPosto.value || "all"
          );
        }
        fillSelectWithAll(elements.adminFilterEmpresa, state.empresas, (e) => e.nome, elements.adminFilterEmpresa.value);
        fillSelect(elements.postoSelect, scopedPostos, (p) => p.nome, elements.postoSelect.value);
        fillSelect(elements.leitorPosto, scopedPostos, (p) => p.nome, elements.leitorPosto.value);
        if (elements.postoEmpresaFilter) {
          fillSelectWithAll(
            elements.postoEmpresaFilter,
            state.empresas,
            (e) => e.nome,
            elements.postoEmpresaFilter.value || "all"
          );
        }
        if (elements.maquininhaCodigo) {
          const storedCodigo = getStoredMaquininhaCodigo();
          if (storedCodigo && !elements.maquininhaCodigo.value) {
            elements.maquininhaCodigo.value = storedCodigo;
          }
          updateMaquininhaPreview(elements.maquininhaCodigo.value);
        }
        fillSelectWithAll(elements.relatorioPostoSelect, scopedPostos, (p) => p.nome, elements.relatorioPostoSelect.value);
        fillSelectWithAll(elements.adminFilterPosto, state.postos, (p) => p.nome, elements.adminFilterPosto.value);
        if (currentUser?.role === "posto" && currentUser.postoId) {
          elements.relatorioPostoSelect.value = currentUser.postoId;
        }

        let funcionariosScope = state.funcionarios;
        if (currentUser?.role === "empresa" && currentUser.empresaId) {
          funcionariosScope = state.funcionarios.filter((f) => f.empresaId === currentUser.empresaId);
        } else if (isColaboradorRole(currentUser?.role) && currentUser.funcionarioId) {
          funcionariosScope = state.funcionarios.filter((f) => f.id === currentUser.funcionarioId);
        }
        fillSelect(elements.relatorioFuncionario, funcionariosScope, (f) => funcionarioLabel(f), elements.relatorioFuncionario.value);

        updateFuncionarioOptions();
      }

      function setMessage(el, text, type = "muted") {
        el.textContent = text;
        el.className = `message ${type}`;
      }

      function setReportMessage(text, type = "muted") {
        setMessage(elements.reportMsg, text, type);
      }

      const pad2 = (value) => String(value).padStart(2, "0");

      function formatDateInput(date) {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
      }

      function formatMonthInput(date) {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
      }

      function getMonthRangeFromInput(value) {
        if (!value) return null;
        const parts = String(value).split("-");
        if (parts.length !== 2) return null;
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
        return { start, end };
      }

      function ensureEmpresaMonthFilter() {
        if (elements.empresaMonthFilter && !elements.empresaMonthFilter.value) {
          elements.empresaMonthFilter.value = formatMonthInput(new Date());
        }
      }

      function ensurePostoMonthFilter() {
        if (elements.postoMonthFilter && !elements.postoMonthFilter.value) {
          elements.postoMonthFilter.value = formatMonthInput(new Date());
        }
      }

      function parseInputDate(value, endOfDay = false) {
        if (!value) return null;
        const parts = String(value).split("-");
        if (parts.length !== 3) return null;
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
        const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
        return Number.isNaN(date.getTime()) ? null : date;
      }

      function getMonthRange(baseDate = new Date()) {
        const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        return { start, end };
      }

      function ensureReportPeriodDefaults() {
        if (elements.reportPeriodStart && elements.reportPeriodEnd) {
          if (!elements.reportPeriodStart.value || !elements.reportPeriodEnd.value) {
            const { start, end } = getMonthRange(new Date());
            if (!elements.reportPeriodStart.value) {
              elements.reportPeriodStart.value = formatDateInput(start);
            }
            if (!elements.reportPeriodEnd.value) {
              elements.reportPeriodEnd.value = formatDateInput(end);
            }
          }
        }
      }

      function resolveReportPeriod() {
        const startValue = elements.reportPeriodStart ? elements.reportPeriodStart.value : "";
        const endValue = elements.reportPeriodEnd ? elements.reportPeriodEnd.value : "";
        let start = parseInputDate(startValue, false);
        let end = parseInputDate(endValue, true);
        if (!start || !end) {
          const range = getMonthRange(new Date());
          start = start || range.start;
          end = end || new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate(), 23, 59, 59, 999);
        }
        if (start && end && start > end) {
          const tmp = start;
          start = end;
          end = tmp;
          if (elements.reportPeriodStart) {
            elements.reportPeriodStart.value = formatDateInput(start);
          }
          if (elements.reportPeriodEnd) {
            elements.reportPeriodEnd.value = formatDateInput(end);
          }
        }
        const formatDate = (value) => value.toLocaleDateString("pt-BR");
        let label = "";
        if (start && end) {
          label = `${formatDate(start)} a ${formatDate(end)}`;
        } else if (start) {
          label = `A partir de ${formatDate(start)}`;
        } else if (end) {
          label = `Ate ${formatDate(end)}`;
        } else {
          label = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        }
        return { start, end, label };
      }

      function isWithinReportPeriod(date, start, end) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      }

      function formatDecimalForExport(value) {
        const amount = Number.isFinite(value) ? value : 0;
        return amount.toFixed(2).replace(".", ",");
      }

      function applyReportBrand(logoEl, nameEl, metaEl, empresa, periodoLabel) {
        const nome = empresa?.nome || "--";
        const cnpjLabel = empresa?.cnpj ? ` | CNPJ: ${empresa.cnpj}` : "";
        nameEl.textContent = `Empresa: ${nome}`;
        metaEl.textContent = `Periodo: ${periodoLabel}${cnpjLabel}`;
        if (empresa?.logoData) {
          logoEl.src = empresa.logoData;
          logoEl.classList.remove("hidden");
        } else {
          logoEl.removeAttribute("src");
          logoEl.classList.add("hidden");
        }
      }

      function escapeHtml(value) {
        const raw = value === null || value === undefined ? "" : String(value);
        return raw
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      async function downloadExcel(filename, html) {
        const content = `\uFEFF${html}`;
        const blob = new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8;" });
        return downloadBlob(filename, blob);
      }

      function padReportRow(row, length) {
        if (row.length >= length) return row;
        return [...row, ...Array.from({ length: length - row.length }, () => "")];
      }

      function buildReportMetaRows(type, headerLength) {
        const rows = [];
        const generatedAt = new Date().toLocaleString("pt-BR");
        const periodo = state.reportData.periodo || "--";
        if (type === "extrato") {
          rows.push(padReportRow(["Empresa", state.reportData.extratoEmpresaNome || "--"], headerLength));
          rows.push(padReportRow(["CNPJ", state.reportData.extratoEmpresaCnpj || "--"], headerLength));
          rows.push(padReportRow(["Colaborador", state.reportData.funcionarioNome || "--"], headerLength));
          rows.push(padReportRow([
            "CPF", state.reportData.funcionarioCpf || "--",
            "Matrícula", state.reportData.funcionarioMatricula || "--",
          ], headerLength));
          rows.push(padReportRow([
            "Contrato", state.reportData.funcionarioContrato || "Sem contrato",
            "Cidade", state.reportData.funcionarioCidade || "Cidade não informada",
          ], headerLength));
          rows.push(padReportRow(["Período", periodo, "Gerado em", generatedAt], headerLength));
        } else if (type === "repasse" && state.reportData.repasseContext === "posto-empresas") {
          rows.push(padReportRow(["Posto", state.reportData.repassePostoNome || "--"], headerLength));
          rows.push(padReportRow(["Cidade", state.reportData.repassePostoCidade || "--"], headerLength));
          rows.push(padReportRow(["Visão", "Empresas que abasteceram neste posto"], headerLength));
          rows.push(padReportRow(["Período", periodo, "Gerado em", generatedAt], headerLength));
        } else {
          rows.push(padReportRow(["Empresa", state.reportData.empresaNome || "--"], headerLength));
          rows.push(padReportRow(["CNPJ", state.reportData.empresaCnpj || "--"], headerLength));
          rows.push(padReportRow(["Período", periodo, "Gerado em", generatedAt], headerLength));
          if (type === "folha") {
            rows.push(padReportRow([
              "Colaboradores", String(state.reportData.folhaColaboradores || 0),
              "Total geral", formatBRL(state.reportData.folhaTotal || 0),
            ], headerLength));
          }
        }
        rows.push(new Array(headerLength).fill(""));
        return rows;
      }

      function getReportExportHeader(type) {
        if (type === "extrato") {
          return ["Data/hora", "Posto", "Cidade do posto", "Combustível", "CNPJ do posto", "Valor (R$)", "ID da transação"];
        }
        if (type === "empresa") {
          return ["Matrícula", "Colaborador", "CPF", "Contrato", "Cidade", "Status", "Transações", "Total no período (R$)"];
        }
        if (type === "repasse") {
          if (state.reportData.repasseContext === "posto-empresas") {
            return ["Empresa", "CNPJ", "Colaboradores", "Abastecimentos", "Total a receber (R$)", "Último abastecimento"];
          }
          return ["Posto", "Cidade", "Contratos atendidos", "CNPJ", "Total a pagar (R$)", "Transações"];
        }
        if (type === "folha") {
          return ["Matrícula", "Nome completo", "CPF", "Contrato", "Cidade", "Empresa", "Período", "Valor total gasto (R$)"];
        }
        return [];
      }

      function getReportNumericCols(type) {
        if (type === "extrato") return [5];
        if (type === "empresa") return [7];
        if (type === "repasse") return state.reportData.repasseContext === "posto-empresas" ? [4] : [4];
        if (type === "folha") return [7];
        return [];
      }

      function getReportIntegerCols(type) {
        if (type === "empresa") return [6];
        if (type === "repasse") return state.reportData.repasseContext === "posto-empresas" ? [2,3] : [5];
        return [];
      }

      function getReportColumnWidths(type) {
        if (type === "extrato") return [21, 28, 24, 18, 21, 16, 38];
        if (type === "empresa") return [16, 34, 18, 26, 24, 14, 14, 21];
        if (type === "repasse") {
          return state.reportData.repasseContext === "posto-empresas"
            ? [38, 22, 18, 18, 24, 28]
            : [30, 24, 42, 21, 22, 14];
        }
        if (type === "folha") return [16, 34, 18, 26, 24, 30, 25, 22];
        return [];
      }

      function getReportTotalConfig(type, data) {
        const rows = Array.isArray(data) ? data : [];
        const sumColumn = (colIndex) => rows.reduce((sum, row) => {
          const value = toNumberCellValue(Array.isArray(row) ? row[colIndex] : null);
          return sum + (value === null ? 0 : Number(value));
        }, 0);
        if (type === "extrato") {
          return { label: "TOTAL DO PERÍODO", values: { 5: sumColumn(5) } };
        }
        if (type === "empresa") {
          return { label: "TOTAL GERAL", values: { 6: sumColumn(6), 7: sumColumn(7) } };
        }
        if (type === "repasse") {
          return state.reportData.repasseContext === "posto-empresas"
            ? { label: "TOTAL A RECEBER", values: { 4: sumColumn(4), 3: sumColumn(3), 2: sumColumn(2) } }
            : { label: "TOTAL GERAL", values: { 4: sumColumn(4), 5: sumColumn(5) } };
        }
        if (type === "folha") {
          return { label: "TOTAL DA FOLHA", values: { 7: sumColumn(7) } };
        }
        return null;
      }

      function buildReportMatrix(type, includeMetaRows) {
        const header = getReportExportHeader(type);
        const data = state.reportData[type] || [];
        if (!header.length) {
          return { header: [], data: [], rows: [] };
        }
        const rows = includeMetaRows
          ? [...buildReportMetaRows(type, header.length), header, ...data]
          : [header, ...data];
        return { header, data, rows };
      }

      function sanitizeFilename(value) {
        const safe = String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        return safe || "atual";
      }

      function escapeXml(value) {
        const raw = value === null || value === undefined ? "" : String(value);
        return raw
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&apos;");
      }

      function columnLetter(index) {
        let value = index;
        let letter = "";
        while (value > 0) {
          const modulo = (value - 1) % 26;
          letter = String.fromCharCode(65 + modulo) + letter;
          value = Math.floor((value - 1) / 26);
        }
        return letter;
      }

      const CRC32_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i += 1) {
          let c = i;
          for (let k = 0; k < 8; k += 1) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          }
          table[i] = c >>> 0;
        }
        return table;
      })();

      function crc32(buffer) {
        let crc = 0xffffffff;
        for (let i = 0; i < buffer.length; i += 1) {
          crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
      }

      function toNumberCellValue(value) {
        if (value === null || value === undefined) return null;
        const raw = String(value).trim();
        if (!raw) return null;
        let normalized = raw;
        if (raw.includes(",")) {
          normalized = raw.replace(/\./g, "").replace(",", ".");
        }
        const num = Number(normalized);
        if (!Number.isFinite(num)) return null;
        return normalized;
      }

      function buildWorksheetXml(rows, options = {}) {
        const numericSet = new Set(options.numericCols || []);
        const integerSet = new Set(options.integerCols || []);
        const titleRowIndex = Number.isFinite(options.titleRowIndex) ? options.titleRowIndex : -1;
        const headerRowIndex = Number.isFinite(options.headerRowIndex) ? options.headerRowIndex : -1;
        const dataStartRowIndex = Number.isFinite(options.dataStartRowIndex)
          ? options.dataStartRowIndex
          : headerRowIndex + 1;
        const totalRowIndex = Number.isFinite(options.totalRowIndex) ? options.totalRowIndex : -1;
        const maxColumns = Math.max(1, ...rows.map((row) => (Array.isArray(row) ? row.length : 1)));
        const maxRows = Math.max(1, rows.length);
        const lastColumn = columnLetter(maxColumns);
        const lastCell = `${lastColumn}${maxRows}`;
        const columnWidths = Array.isArray(options.columnWidths) ? options.columnWidths : [];
        const colsXml = Array.from({ length: maxColumns }, (_, index) => {
          const rawWidth = Number(columnWidths[index]);
          const width = Number.isFinite(rawWidth) && rawWidth > 0 ? Math.min(60, Math.max(9, rawWidth)) : 18;
          return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
        }).join("");
        const metaStart = titleRowIndex >= 0 ? titleRowIndex + 1 : 0;
        const metaEnd = headerRowIndex > metaStart ? headerRowIndex - 1 : -1;
        const rowXml = rows
          .map((row, rowIndex) => {
            const isTitleRow = rowIndex === titleRowIndex;
            const isHeaderRow = rowIndex === headerRowIndex;
            const isTotalRow = rowIndex === totalRowIndex;
            const isDataRow = rowIndex >= dataStartRowIndex && (totalRowIndex < 0 || rowIndex < totalRowIndex);
            const isMetaRow = rowIndex >= metaStart && rowIndex <= metaEnd;
            const rowHeight = isTitleRow ? 30 : isHeaderRow ? 26 : isMetaRow ? 21 : isTotalRow ? 25 : 20;
            const cells = (Array.isArray(row) ? row : [row]).map((cell, colIndex) => {
              const coord = `${columnLetter(colIndex + 1)}${rowIndex + 1}`;
              const useNumeric = (isDataRow || isTotalRow) && numericSet.has(colIndex);
              const useInteger = (isDataRow || isTotalRow) && integerSet.has(colIndex);
              const numericValue = useNumeric || useInteger ? toNumberCellValue(cell) : null;
              let styleId = 0;
              if (isTitleRow) {
                styleId = 1;
              } else if (isHeaderRow) {
                styleId = 2;
              } else if (isMetaRow) {
                styleId = colIndex % 2 === 0 && String(cell ?? "").trim() ? 5 : 6;
              } else if (isTotalRow) {
                if (numericValue !== null && useNumeric) styleId = 9;
                else if (numericValue !== null && useInteger) styleId = 10;
                else styleId = 8;
              } else if (isDataRow) {
                const striped = (rowIndex - dataStartRowIndex) % 2 === 1;
                if (numericValue !== null && useNumeric) styleId = striped ? 13 : 4;
                else if (numericValue !== null && useInteger) styleId = striped ? 14 : 7;
                else styleId = striped ? 12 : 3;
              }
              const styleAttr = styleId ? ` s="${styleId}"` : "";
              if (numericValue !== null) {
                return `<c r="${coord}"${styleAttr}><v>${numericValue}</v></c>`;
              }
              const value = escapeXml(String(cell ?? ""));
              return `<c r="${coord}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`;
            });
            return `<row r="${rowIndex + 1}" ht="${rowHeight}" customHeight="1">${cells.join("")}</row>`;
          })
          .join("");
        const freezeRow = headerRowIndex >= 0 ? headerRowIndex + 2 : 1;
        const paneXml = headerRowIndex >= 0
          ? `<pane ySplit="${headerRowIndex + 1}" topLeftCell="A${freezeRow}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${freezeRow}" sqref="A${freezeRow}"/>`
          : `<selection activeCell="A1" sqref="A1"/>`;
        const mergeXml = titleRowIndex >= 0 && maxColumns > 1
          ? `<mergeCells count="1"><mergeCell ref="A${titleRowIndex + 1}:${lastColumn}${titleRowIndex + 1}"/></mergeCells>`
          : "";
        const dataLastRow = totalRowIndex >= 0 ? totalRowIndex : maxRows - 1;
        const filterXml = headerRowIndex >= 0 && dataLastRow > headerRowIndex
          ? `<autoFilter ref="A${headerRowIndex + 1}:${lastColumn}${dataLastRow}"/>`
          : "";
        return `<?xml version="1.0" encoding="UTF-8"?>` +
          `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
          `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
          `<dimension ref="A1:${lastCell}"/>` +
          `<sheetViews><sheetView workbookViewId="0" showGridLines="0">${paneXml}</sheetView></sheetViews>` +
          `<sheetFormatPr defaultRowHeight="20"/>` +
          `<cols>${colsXml}</cols>` +
          `<sheetData>${rowXml}</sheetData>` +
          `${filterXml}${mergeXml}` +
          `<printOptions horizontalCentered="1" verticalCentered="0"/>` +
          `<pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.2" footer="0.3"/>` +
          `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>` +
          `<headerFooter><oddFooter>&amp;LCredTank - Relatório gerencial&amp;R Página &amp;P de &amp;N</oddFooter></headerFooter>` +
          `</worksheet>`;
      }

      function createZipStore(files) {
        const encoder = new TextEncoder();
        const fileParts = [];
        const centralParts = [];
        let offset = 0;
        files.forEach((file) => {
          const nameBytes = encoder.encode(file.name);
          const dataBytes = file.content instanceof Uint8Array ? file.content : encoder.encode(file.content || "");
          const crc = crc32(dataBytes);
          const localHeader = new Uint8Array(30 + nameBytes.length);
          const localView = new DataView(localHeader.buffer);
          localView.setUint32(0, 0x04034b50, true);
          localView.setUint16(4, 20, true);
          localView.setUint16(6, 0, true);
          localView.setUint16(8, 0, true);
          localView.setUint16(10, 0, true);
          localView.setUint16(12, 0, true);
          localView.setUint32(14, crc, true);
          localView.setUint32(18, dataBytes.length, true);
          localView.setUint32(22, dataBytes.length, true);
          localView.setUint16(26, nameBytes.length, true);
          localView.setUint16(28, 0, true);
          localHeader.set(nameBytes, 30);
          fileParts.push(localHeader, dataBytes);

          const centralHeader = new Uint8Array(46 + nameBytes.length);
          const centralView = new DataView(centralHeader.buffer);
          centralView.setUint32(0, 0x02014b50, true);
          centralView.setUint16(4, 20, true);
          centralView.setUint16(6, 20, true);
          centralView.setUint16(8, 0, true);
          centralView.setUint16(10, 0, true);
          centralView.setUint16(12, 0, true);
          centralView.setUint16(14, 0, true);
          centralView.setUint32(16, crc, true);
          centralView.setUint32(20, dataBytes.length, true);
          centralView.setUint32(24, dataBytes.length, true);
          centralView.setUint16(28, nameBytes.length, true);
          centralView.setUint16(30, 0, true);
          centralView.setUint16(32, 0, true);
          centralView.setUint16(34, 0, true);
          centralView.setUint16(36, 0, true);
          centralView.setUint32(38, 0, true);
          centralView.setUint32(42, offset, true);
          centralHeader.set(nameBytes, 46);
          centralParts.push(centralHeader);

          offset += localHeader.length + dataBytes.length;
        });
        const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
        const endRecord = new Uint8Array(22);
        const endView = new DataView(endRecord.buffer);
        endView.setUint32(0, 0x06054b50, true);
        endView.setUint16(4, 0, true);
        endView.setUint16(6, 0, true);
        endView.setUint16(8, files.length, true);
        endView.setUint16(10, files.length, true);
        endView.setUint32(12, centralSize, true);
        endView.setUint32(16, offset, true);
        endView.setUint16(20, 0, true);
        return new Blob([...fileParts, ...centralParts, endRecord], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      }

      function buildXlsxBlob(rows, sheetName, numericCols = [], styleConfig = {}) {
        const safeName = String(sheetName || "Relatorio")
          .slice(0, 31)
          .replace(/[\/?*[\]:]/g, " ");
        const worksheetXml = buildWorksheetXml(rows, {
          numericCols,
          integerCols: styleConfig.integerCols || [],
          columnWidths: styleConfig.columnWidths || [],
          titleRowIndex: styleConfig.titleRowIndex,
          headerRowIndex: styleConfig.headerRowIndex,
          dataStartRowIndex: styleConfig.dataStartRowIndex,
          totalRowIndex: styleConfig.totalRowIndex,
        });
        const workbookXml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
          `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews>` +
          `<sheets><sheet name="${escapeXml(safeName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
        const relsXml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" ` +
          `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ` +
          `Target="xl/workbook.xml"/></Relationships>`;
        const workbookRelsXml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" ` +
          `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ` +
          `Target="worksheets/sheet1.xml"/>` +
          `<Relationship Id="rId2" ` +
          `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ` +
          `Target="styles.xml"/></Relationships>`;
        const stylesXml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
          `<numFmts count="1"><numFmt numFmtId="164" formatCode='&quot;R$&quot; #,##0.00;[Red]-&quot;R$&quot; #,##0.00'/></numFmts>` +
          `<fonts count="5">` +
          `<font><sz val="11"/><color rgb="FF0F172A"/><name val="Aptos"/><family val="2"/></font>` +
          `<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/><family val="2"/></font>` +
          `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font>` +
          `<font><b/><sz val="10"/><color rgb="FF475569"/><name val="Aptos"/><family val="2"/></font>` +
          `<font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Aptos"/><family val="2"/></font>` +
          `</fonts>` +
          `<fills count="7">` +
          `<fill><patternFill patternType="none"/></fill>` +
          `<fill><patternFill patternType="gray125"/></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FF075E54"/><bgColor indexed="64"/></patternFill></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>` +
          `</fills>` +
          `<borders count="3">` +
          `<border><left/><right/><top/><bottom/><diagonal/></border>` +
          `<border><left style="thin"><color rgb="FFD7DEE7"/></left><right style="thin"><color rgb="FFD7DEE7"/></right><top style="thin"><color rgb="FFD7DEE7"/></top><bottom style="thin"><color rgb="FFD7DEE7"/></bottom><diagonal/></border>` +
          `<border><left/><right/><top style="medium"><color rgb="FF0F766E"/></top><bottom/><diagonal/></border>` +
          `</borders>` +
          `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
          `<cellXfs count="15">` +
          `<xf fontId="0" fillId="0" borderId="0" xfId="0"/>` +
          `<xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>` +
          `<xf fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
          `<xf fontId="0" fillId="0" borderId="1" xfId="0" numFmtId="49" applyNumberFormat="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>` +
          `<xf fontId="0" fillId="0" borderId="1" xfId="0" numFmtId="164" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>` +
          `<xf fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf>` +
          `<xf fontId="0" fillId="0" borderId="1" xfId="0" numFmtId="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>` +
          `<xf fontId="4" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>` +
          `<xf fontId="4" fillId="5" borderId="2" xfId="0" numFmtId="164" applyFont="1" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf fontId="4" fillId="5" borderId="2" xfId="0" numFmtId="1" applyFont="1" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>` +
          `<xf fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>` +
          `<xf fontId="0" fillId="6" borderId="1" xfId="0" numFmtId="49" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>` +
          `<xf fontId="0" fillId="6" borderId="1" xfId="0" numFmtId="164" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf fontId="0" fillId="6" borderId="1" xfId="0" numFmtId="1" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>` +
          `</cellXfs>` +
          `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
          `</styleSheet>`;
        const contentTypesXml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
          `</Types>`;
        return createZipStore([
          { name: "[Content_Types].xml", content: contentTypesXml },
          { name: "_rels/.rels", content: relsXml },
          { name: "xl/workbook.xml", content: workbookXml },
          { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
          { name: "xl/styles.xml", content: stylesXml },
          { name: "xl/worksheets/sheet1.xml", content: worksheetXml },
        ]);
      }

      function buildMultiSheetXlsxBlob(sheetDefs) {
        const sheets = (Array.isArray(sheetDefs) ? sheetDefs : []).filter((sheet) => sheet && Array.isArray(sheet.rows));
        if (!sheets.length) return buildXlsxBlob([["Sem dados"]], "Relatorio");
        const usedNames = new Set();
        const normalized = sheets.map((sheet, index) => {
          let base = String(sheet.name || `Planilha ${index + 1}`)
            .slice(0, 31)
            .replace(/[\/?*[\]:]/g, " ")
            .trim() || `Planilha ${index + 1}`;
          let name = base;
          let suffix = 2;
          while (usedNames.has(name.toLowerCase())) {
            const tag = ` ${suffix}`;
            name = `${base.slice(0, Math.max(1, 31 - tag.length))}${tag}`;
            suffix += 1;
          }
          usedNames.add(name.toLowerCase());
          return { ...sheet, name };
        });
        const worksheetFiles = normalized.map((sheet, index) => ({
          name: `xl/worksheets/sheet${index + 1}.xml`,
          content: buildWorksheetXml(sheet.rows, {
            numericCols: sheet.numericCols || [],
            integerCols: sheet.integerCols || [],
            columnWidths: sheet.columnWidths || [],
            titleRowIndex: sheet.titleRowIndex,
            headerRowIndex: sheet.headerRowIndex,
            dataStartRowIndex: sheet.dataStartRowIndex,
            totalRowIndex: sheet.totalRowIndex,
          }),
        }));
        const workbookXml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000"/></bookViews>` +
          `<sheets>${normalized.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets>` +
          `</workbook>`;
        const relsXml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
          `</Relationships>`;
        const styleRid = normalized.length + 1;
        const workbookRelsXml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          normalized.map((sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("") +
          `<Relationship Id="rId${styleRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
          `</Relationships>`;
        const stylesXml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
          `<numFmts count="1"><numFmt numFmtId="164" formatCode='&quot;R$&quot; #,##0.00;[Red]-&quot;R$&quot; #,##0.00'/></numFmts>` +
          `<fonts count="5">` +
          `<font><sz val="11"/><color rgb="FF0F172A"/><name val="Aptos"/><family val="2"/></font>` +
          `<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/><family val="2"/></font>` +
          `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font>` +
          `<font><b/><sz val="10"/><color rgb="FF475569"/><name val="Aptos"/><family val="2"/></font>` +
          `<font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Aptos"/><family val="2"/></font>` +
          `</fonts>` +
          `<fills count="7">` +
          `<fill><patternFill patternType="none"/></fill>` +
          `<fill><patternFill patternType="gray125"/></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FF075E54"/><bgColor indexed="64"/></patternFill></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>` +
          `<fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>` +
          `</fills>` +
          `<borders count="3">` +
          `<border><left/><right/><top/><bottom/><diagonal/></border>` +
          `<border><left style="thin"><color rgb="FFD7DEE7"/></left><right style="thin"><color rgb="FFD7DEE7"/></right><top style="thin"><color rgb="FFD7DEE7"/></top><bottom style="thin"><color rgb="FFD7DEE7"/></bottom><diagonal/></border>` +
          `<border><left/><right/><top style="medium"><color rgb="FF0F766E"/></top><bottom/><diagonal/></border>` +
          `</borders>` +
          `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
          `<cellXfs count="15">` +
          `<xf fontId="0" fillId="0" borderId="0" xfId="0"/>` +
          `<xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>` +
          `<xf fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
          `<xf fontId="0" fillId="0" borderId="1" xfId="0" numFmtId="49" applyNumberFormat="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>` +
          `<xf fontId="0" fillId="0" borderId="1" xfId="0" numFmtId="164" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>` +
          `<xf fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf>` +
          `<xf fontId="0" fillId="0" borderId="1" xfId="0" numFmtId="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>` +
          `<xf fontId="4" fillId="5" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>` +
          `<xf fontId="4" fillId="5" borderId="2" xfId="0" numFmtId="164" applyFont="1" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf fontId="4" fillId="5" borderId="2" xfId="0" numFmtId="1" applyFont="1" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>` +
          `<xf fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>` +
          `<xf fontId="0" fillId="6" borderId="1" xfId="0" numFmtId="49" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>` +
          `<xf fontId="0" fillId="6" borderId="1" xfId="0" numFmtId="164" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>` +
          `<xf fontId="0" fillId="6" borderId="1" xfId="0" numFmtId="1" applyFill="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>` +
          `</cellXfs>` +
          `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
          `</styleSheet>`;
        const contentTypesXml =
          `<?xml version="1.0" encoding="UTF-8"?>` +
          `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
          `<Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          normalized.map((sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
          `</Types>`;
        return createZipStore([
          { name: "[Content_Types].xml", content: contentTypesXml },
          { name: "_rels/.rels", content: relsXml },
          { name: "xl/workbook.xml", content: workbookXml },
          { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml },
          { name: "xl/styles.xml", content: stylesXml },
          ...worksheetFiles,
        ]);
      }

      function buildProfessionalSummarySheets(type, data) {
        const rows = Array.isArray(data) ? data : [];
        const empresaNome = type === "extrato" ? (state.reportData.extratoEmpresaNome || "--") : (state.reportData.empresaNome || "--");
        const empresaCnpj = type === "extrato" ? (state.reportData.extratoEmpresaCnpj || "--") : (state.reportData.empresaCnpj || "--");
        const periodo = state.reportData.periodo || "--";
        const generatedAt = new Date().toLocaleString("pt-BR");
        const makeSheet = (name, title, header, dataRows, opts = {}) => {
          const meta = [
            padReportRow(["Empresa", empresaNome], header.length),
            padReportRow(["CNPJ", empresaCnpj], header.length),
            padReportRow(["Período", periodo, "Gerado em", generatedAt], header.length),
            ...(Array.isArray(opts.metaRows) ? opts.metaRows.map((row) => padReportRow(row, header.length)) : []),
            new Array(header.length).fill(""),
          ];
          const totalRow = Array.isArray(opts.totalRow) ? padReportRow(opts.totalRow, header.length) : null;
          const sheetRows = [
            padReportRow([`${APP_NAME} | ${title}`], header.length),
            ...meta,
            header,
            ...dataRows,
            ...(totalRow ? [totalRow] : []),
          ];
          const headerRowIndex = 1 + meta.length;
          return {
            name,
            rows: sheetRows,
            numericCols: opts.numericCols || [],
            integerCols: opts.integerCols || [],
            columnWidths: opts.columnWidths || [],
            titleRowIndex: 0,
            headerRowIndex,
            dataStartRowIndex: headerRowIndex + 1,
            totalRowIndex: totalRow ? sheetRows.length - 1 : -1,
          };
        };
        const groupRows = (contractIndex, cityIndex, statusIndex, txIndex, valueIndex) => {
          const byContractCity = new Map();
          const byCity = new Map();
          const byContract = new Map();
          let totalValue = 0;
          let totalTx = 0;
          let active = 0;
          rows.forEach((row) => {
            const contrato = String(row[contractIndex] || "Sem contrato");
            const cidade = String(row[cityIndex] || "Cidade não informada");
            const tx = txIndex >= 0 ? Number(toNumberCellValue(row[txIndex]) || 0) : 0;
            const value = Number(toNumberCellValue(row[valueIndex]) || 0);
            const ativo = statusIndex >= 0 ? String(row[statusIndex] || "").toLowerCase() === "ativo" : true;
            totalValue += value;
            totalTx += tx;
            if (ativo) active += 1;

            const key = `${contrato}|||${cidade}`;
            const cc = byContractCity.get(key) || { contrato, cidade, pessoas: 0, ativos: 0, tx: 0, total: 0 };
            cc.pessoas += 1; cc.ativos += ativo ? 1 : 0; cc.tx += tx; cc.total += value;
            byContractCity.set(key, cc);

            const city = byCity.get(cidade) || { cidade, pessoas: 0, ativos: 0, tx: 0, total: 0 };
            city.pessoas += 1; city.ativos += ativo ? 1 : 0; city.tx += tx; city.total += value;
            byCity.set(cidade, city);

            const contract = byContract.get(contrato) || { contrato, pessoas: 0, ativos: 0, tx: 0, total: 0 };
            contract.pessoas += 1; contract.ativos += ativo ? 1 : 0; contract.tx += tx; contract.total += value;
            byContract.set(contrato, contract);
          });
          return { byContractCity, byCity, byContract, totalValue, totalTx, active };
        };

        if (type === "empresa" || type === "folha") {
          const isEmpresa = type === "empresa";
          const agg = groupRows(3, 4, isEmpresa ? 5 : -1, isEmpresa ? 6 : -1, 7);
          const contratosCount = agg.byContract.size;
          const cidadesCount = agg.byCity.size;
          const resumoHeader = ["Contrato", "Cidade", "Colaboradores", ...(isEmpresa ? ["Ativos", "Transações"] : []), "Total (R$)", "Participação"];
          const combined = Array.from(agg.byContractCity.values())
            .sort((a, b) => b.total - a.total || a.contrato.localeCompare(b.contrato, "pt-BR") || a.cidade.localeCompare(b.cidade, "pt-BR"))
            .map((g) => {
              const pct = agg.totalValue > 0 ? `${((g.total / agg.totalValue) * 100).toFixed(1).replace(".", ",")}%` : "0,0%";
              return isEmpresa
                ? [g.contrato, g.cidade, String(g.pessoas), String(g.ativos), String(g.tx), formatDecimalForExport(g.total), pct]
                : [g.contrato, g.cidade, String(g.pessoas), formatDecimalForExport(g.total), pct];
            });
          const metaRows = isEmpresa
            ? [
                ["Colaboradores", String(rows.length), "Contratos", String(contratosCount), "Cidades", String(cidadesCount)],
                ["Ativos", String(agg.active), "Transações", String(agg.totalTx), "Total", formatBRL(agg.totalValue)],
              ]
            : [
                ["Colaboradores", String(rows.length), "Contratos", String(contratosCount)],
                ["Cidades", String(cidadesCount), "Total", formatBRL(agg.totalValue)],
              ];
          const summary = makeSheet(
            "Resumo Executivo",
            isEmpresa ? "Resumo executivo da empresa" : "Resumo executivo - desconto em folha",
            resumoHeader,
            combined,
            {
              metaRows,
              numericCols: [isEmpresa ? 5 : 3],
              integerCols: isEmpresa ? [2, 3, 4] : [2],
              columnWidths: isEmpresa ? [28, 24, 18, 15, 16, 22, 16] : [28, 24, 26, 22, 16],
              totalRow: isEmpresa
                ? ["TOTAL GERAL", "", String(rows.length), String(agg.active), String(agg.totalTx), formatDecimalForExport(agg.totalValue), "100,0%"]
                : ["TOTAL GERAL", "", String(rows.length), formatDecimalForExport(agg.totalValue), "100,0%"],
            }
          );

          const cityRows = Array.from(agg.byCity.values())
            .sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, "pt-BR"))
            .map((g) => {
              const avg = g.pessoas ? g.total / g.pessoas : 0;
              return isEmpresa
                ? [g.cidade, String(g.pessoas), String(g.ativos), String(g.tx), formatDecimalForExport(g.total), formatDecimalForExport(avg)]
                : [g.cidade, String(g.pessoas), formatDecimalForExport(g.total), formatDecimalForExport(avg)];
            });
          const cityHeader = isEmpresa
            ? ["Cidade", "Colaboradores", "Ativos", "Transações", "Total (R$)", "Média por colaborador (R$)"]
            : ["Cidade", "Colaboradores", "Total (R$)", "Média por colaborador (R$)"];
          const byCity = makeSheet("Por Cidade", "Consolidado por cidade", cityHeader, cityRows, {
            numericCols: isEmpresa ? [4, 5] : [2, 3],
            integerCols: isEmpresa ? [1, 2, 3] : [1],
            columnWidths: isEmpresa ? [32, 18, 14, 16, 22, 26] : [32, 20, 22, 26],
            totalRow: isEmpresa
              ? ["TOTAL GERAL", String(rows.length), String(agg.active), String(agg.totalTx), formatDecimalForExport(agg.totalValue), ""]
              : ["TOTAL GERAL", String(rows.length), formatDecimalForExport(agg.totalValue), ""],
          });

          const contractRows = Array.from(agg.byContract.values())
            .sort((a, b) => b.total - a.total || a.contrato.localeCompare(b.contrato, "pt-BR"))
            .map((g) => {
              const avg = g.pessoas ? g.total / g.pessoas : 0;
              return isEmpresa
                ? [g.contrato, String(g.pessoas), String(g.ativos), String(g.tx), formatDecimalForExport(g.total), formatDecimalForExport(avg)]
                : [g.contrato, String(g.pessoas), formatDecimalForExport(g.total), formatDecimalForExport(avg)];
            });
          const contractHeader = isEmpresa
            ? ["Contrato", "Colaboradores", "Ativos", "Transações", "Total (R$)", "Média por colaborador (R$)"]
            : ["Contrato", "Colaboradores", "Total (R$)", "Média por colaborador (R$)"];
          const byContract = makeSheet("Por Contrato", "Consolidado por contrato", contractHeader, contractRows, {
            numericCols: isEmpresa ? [4, 5] : [2, 3],
            integerCols: isEmpresa ? [1, 2, 3] : [1],
            columnWidths: isEmpresa ? [38, 18, 14, 16, 22, 26] : [38, 20, 22, 26],
            totalRow: isEmpresa
              ? ["TOTAL GERAL", String(rows.length), String(agg.active), String(agg.totalTx), formatDecimalForExport(agg.totalValue), ""]
              : ["TOTAL GERAL", String(rows.length), formatDecimalForExport(agg.totalValue), ""],
          });
          return [summary, byCity, byContract];
        }

        if (type === "extrato") {
          const byCityMap = new Map();
          let total = 0;
          rows.forEach((row) => {
            const posto = String(row[1] || "--");
            const cidade = String(row[2] || "Cidade não informada");
            const value = Number(toNumberCellValue(row[5]) || 0);
            total += value;
            const key = `${cidade}|||${posto}`;
            const entry = byCityMap.get(key) || { cidade, posto, tx: 0, total: 0 };
            entry.tx += 1;
            entry.total += value;
            byCityMap.set(key, entry);
          });
          const grouped = Array.from(byCityMap.values())
            .sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, "pt-BR"))
            .map((g) => [g.cidade, g.posto, String(g.tx), formatDecimalForExport(g.total)]);
          return [makeSheet("Resumo", "Resumo do extrato por cidade e posto", ["Cidade", "Posto", "Transações", "Total (R$)"], grouped, {
            metaRows: [
              ["Contrato", state.reportData.funcionarioContrato || "Sem contrato", "Cidade do colaborador", state.reportData.funcionarioCidade || "Cidade não informada"],
              ["Transações", String(rows.length), "Total", formatBRL(total)],
            ],
            numericCols: [3],
            integerCols: [2],
            columnWidths: [28, 36, 16, 22],
            totalRow: ["TOTAL GERAL", "", String(rows.length), formatDecimalForExport(total)],
          })];
        }

        if (type === "repasse") {
          if (state.reportData.repasseContext === "posto-empresas") {
            const fuelMap = new Map();
            const empresaMap = new Map();
            let total = 0;
            rows.forEach((row) => {
              const empresa = String(row[2] || "--");
              const combustivel = String(row[4] || "Não informado");
              const value = Number(toNumberCellValue(row[5]) || 0);
              total += value;

              const fuelEntry = fuelMap.get(combustivel) || { combustivel, tx: 0, total: 0 };
              fuelEntry.tx += 1;
              fuelEntry.total += value;
              fuelMap.set(combustivel, fuelEntry);

              const empresaEntry = empresaMap.get(empresa) || { empresa, tx: 0, total: 0 };
              empresaEntry.tx += 1;
              empresaEntry.total += value;
              empresaMap.set(empresa, empresaEntry);
            });

            const fuelRows = Array.from(fuelMap.values())
              .sort((a, b) => b.total - a.total || a.combustivel.localeCompare(b.combustivel, "pt-BR"))
              .map((g) => [
                g.combustivel,
                String(g.tx),
                formatDecimalForExport(g.total),
                total > 0 ? `${((g.total / total) * 100).toFixed(1).replace(".", ",")}%` : "0,0%",
              ]);

            const empresaRows = Array.from(empresaMap.values())
              .sort((a, b) => b.total - a.total || a.empresa.localeCompare(b.empresa, "pt-BR"))
              .map((g) => [g.empresa, String(g.tx), formatDecimalForExport(g.total)]);

            return [
              makeSheet(
                "Por Combustível",
                "Faturamento do posto consolidado por combustível",
                ["Combustível", "Transações", "Total a cobrar (R$)", "Participação"],
                fuelRows,
                {
                  metaRows: [
                    ["Posto", state.reportData.repassePostoNome || "--"],
                    ["Período", state.reportData.periodo || "--", "Transações", String(rows.length)],
                  ],
                  numericCols: [2],
                  integerCols: [1],
                  columnWidths: [30, 18, 24, 18],
                  totalRow: ["TOTAL GERAL", String(rows.length), formatDecimalForExport(total), "100,0%"],
                }
              ),
              makeSheet(
                "Por Empresa",
                "Faturamento do posto consolidado por empresa",
                ["Empresa", "Transações", "Total a cobrar (R$)"],
                empresaRows,
                {
                  numericCols: [2],
                  integerCols: [1],
                  columnWidths: [42, 18, 24],
                  totalRow: ["TOTAL GERAL", String(rows.length), formatDecimalForExport(total)],
                }
              ),
            ];
          }

          const cityMap = new Map();
          let total = 0;
          let txTotal = 0;
          rows.forEach((row) => {
            const cidade = String(row[1] || "Cidade não informada");
            const value = Number(toNumberCellValue(row[4]) || 0);
            const tx = Number(toNumberCellValue(row[5]) || 0);
            const entry = cityMap.get(cidade) || { cidade, unidades: 0, tx: 0, total: 0 };
            entry.unidades += 1; entry.tx += tx; entry.total += value;
            cityMap.set(cidade, entry);
            total += value; txTotal += tx;
          });
          const cityRows = Array.from(cityMap.values())
            .sort((a, b) => b.total - a.total || a.cidade.localeCompare(b.cidade, "pt-BR"))
            .map((g) => [g.cidade, String(g.unidades), String(g.tx), formatDecimalForExport(g.total)]);
          return [makeSheet("Resumo", "Resumo do relatório de postos por cidade", ["Cidade", "Registros", "Transações", "Total (R$)"], cityRows, {
            metaRows: [["Transações", String(txTotal), "Total", formatBRL(total)]],
            numericCols: [3],
            integerCols: [1, 2],
            columnWidths: [30, 18, 18, 22],
            totalRow: ["TOTAL GERAL", String(rows.length), String(txTotal), formatDecimalForExport(total)],
          })];
        }
        return [];
      }

      function blobToBase64Payload(blob) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const raw = String(reader.result || "");
            const marker = raw.indexOf("base64,");
            if (marker < 0) {
              resolve("");
              return;
            }
            resolve(raw.slice(marker + 7));
          };
          reader.onerror = () => reject(new Error("blob_read_failed"));
          reader.readAsDataURL(blob);
        });
      }

      async function downloadBlob(filename, blob) {
        if (!(blob instanceof Blob)) return false;
        if (IS_ANDROID_WEBVIEW_APP && canUseNativeBridge()) {
          try {
            const base64Payload = await blobToBase64Payload(blob);
            if (base64Payload) {
              const nativeResult = await callNativeBridgeAsync(
                "downloadFile",
                String(filename || "arquivo"),
                String(blob.type || "application/octet-stream"),
                base64Payload
              );
              if (nativeResult?.ok) {
                return true;
              }
            }
          } catch (error) {
          }
        }
        try {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          return true;
        } catch (error) {
          return false;
        }
      }

      async function exportReportCsv(type) {
        const includeMeta = false;
        const { data, rows } = buildReportMatrix(type, includeMeta);
        if (!data.length) {
          setReportMessage("Sem dados para exportar.", "warn");
          return;
        }
        const csv = rows
          .map((row) =>
            row
              .map((cell) => {
                const text = String(cell ?? "");
                return `"${text.replace(/\"/g, '""')}"`;
              })
              .join(";")
          )
          .join("\r\n");
        const safePeriodo = sanitizeFilename(state.reportData.periodo || "atual");
        const filename = `relatorio-${type}-${safePeriodo}.csv`;
        const downloaded = await downloadBlob(filename, new Blob([csv], { type: "text/csv;charset=utf-8;" }));
        setReportMessage(downloaded ? "Arquivo CSV gerado." : "Nao foi possivel baixar o arquivo CSV.", downloaded ? "ok" : "warn");
      }

      async function exportReportXlsx(type) {
        const header = getReportExportHeader(type);
        const data = state.reportData[type] || [];
        if (!data.length) {
          setReportMessage("Sem dados para exportar.", "warn");
          return;
        }
        if (!header.length) {
          setReportMessage("Relatorio invalido para exportar.", "warn");
          return;
        }
        const title = REPORT_EXPORT_MAP[type]?.label || "Relatorio";
        const titleText = `${APP_NAME} | ${title}`;
        const titleRow = padReportRow([titleText], header.length);
        const metaRows = buildReportMetaRows(type, header.length);
        const totalConfig = getReportTotalConfig(type, data);
        const totalRow = new Array(header.length).fill("");
        if (totalConfig) {
          totalRow[0] = totalConfig.label;
          Object.entries(totalConfig.values || {}).forEach(([colIndex, value]) => {
            const index = Number(colIndex);
            if (Number.isInteger(index) && index >= 0 && index < totalRow.length) {
              const isInteger = getReportIntegerCols(type).includes(index);
              totalRow[index] = isInteger
                ? String(Math.round(Number(value || 0)))
                : Number(value || 0).toFixed(2).replace(".", ",");
            }
          });
        }
        const rows = [titleRow, ...metaRows, header, ...data, totalRow];
        const headerRowIndex = 1 + metaRows.length;
        const dataStartRowIndex = headerRowIndex + 1;
        const totalRowIndex = rows.length - 1;
        const detailSheet = {
          name: type === "folha" ? "Colaboradores" : type === "empresa" ? "Detalhamento" : title,
          rows,
          numericCols: getReportNumericCols(type),
          integerCols: getReportIntegerCols(type),
          columnWidths: getReportColumnWidths(type),
          titleRowIndex: 0,
          headerRowIndex,
          dataStartRowIndex,
          totalRowIndex,
        };
        const summarySheets = buildProfessionalSummarySheets(type, data);
        const sheets = [...summarySheets, detailSheet];
        const safePeriodo = sanitizeFilename(state.reportData.periodo || "atual");
        const empresaArquivo = sanitizeFilename(
          type === "extrato" ? state.reportData.extratoEmpresaNome : state.reportData.empresaNome
        );
        const filename = `${sanitizeFilename(title)}-${empresaArquivo}-${safePeriodo}.xlsx`;
        const blob = buildMultiSheetXlsxBlob(sheets);
        const downloaded = await downloadBlob(filename, blob);
        setReportMessage(
          downloaded
            ? "Arquivo XLSX profissional gerado com resumo executivo, visoes por cidade e contrato, filtros e detalhamento completo."
            : "Nao foi possivel baixar o arquivo XLSX.",
          downloaded ? "ok" : "warn"
        );
      }

      function buildExcelRow(cells, cellTag, rowClass) {
        const rowClassAttr = rowClass ? ` class="${rowClass}"` : "";
        const safeCells = cells.map((cell) => `<${cellTag}>${escapeHtml(cell)}</${cellTag}>`).join("");
        return `<tr${rowClassAttr}>${safeCells}</tr>`;
      }

      async function exportReportExcel(type) {
        const { data, header } = buildReportMatrix(type, false);
        if (!data.length) {
          setReportMessage("Sem dados para exportar.", "warn");
          return;
        }
        if (!header.length) {
          setReportMessage("Relatorio invalido para exportar.", "warn");
          return;
        }
        const safePeriodo = sanitizeFilename(state.reportData.periodo || "atual");
        const filename = `relatorio-${type}-${safePeriodo}.xls`;
        const html = `
          <html>
            <head>
              <meta charset="utf-8" />
              <style>
                body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; }
                table { border-collapse: collapse; width: 100%; }
                th { background: #f8fafc; color: #0f172a; text-transform: uppercase; letter-spacing: 0.4px; font-size: 12px; border: 1px solid #e5e7eb; padding: 8px; }
                td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; }
              </style>
            </head>
            <body>
              <table>
                ${buildExcelRow(header, "th")}
                ${data.map((row) => buildExcelRow(row, "td")).join("")}
              </table>
            </body>
          </html>
        `;
        const downloaded = await downloadExcel(filename, html);
        setReportMessage(downloaded ? "Arquivo Excel gerado." : "Nao foi possivel baixar o arquivo Excel.", downloaded ? "ok" : "warn");
      }

      function updateReportExportOptions(role) {
        const options = Object.entries(REPORT_EXPORT_MAP)
          .filter(([, config]) => config.roles.includes(role))
          .map(([value, config]) => ({ value, label: config.label }));
        elements.reportExportType.innerHTML = "";
        options.forEach((option) => {
          const el = document.createElement("option");
          el.value = option.value;
          el.textContent = option.label;
          elements.reportExportType.appendChild(el);
        });
        if (!options.length) {
          elements.reportExportBtn.disabled = true;
          elements.reportExportType.disabled = true;
          return;
        }
        const current = elements.reportExportType.value;
        if (!options.some((opt) => opt.value === current)) {
          elements.reportExportType.value = options[0].value;
        }
        elements.reportExportType.disabled = options.length <= 1;
        elements.reportExportBtn.disabled = false;
      }

      async function handleReportExport() {
        const type = elements.reportExportType.value;
        if (!type || !REPORT_EXPORT_MAP[type]) {
          setReportMessage("Selecione um relatorio para exportar.", "warn");
          return;
        }
        const format = elements.reportExportFormat.value;
        if (format === "csv") {
          await exportReportCsv(type);
          return;
        }
        if (format === "xlsx") {
          await exportReportXlsx(type);
          return;
        }
        if (format === "excel") {
          await exportReportExcel(type);
          return;
        }
        const config = REPORT_EXPORT_MAP[type];
        await printReport(config.id, config.title);
      }

      function statusClass(status) {
        if (status === "ok") return "status ok";
        if (status === "bad") return "status bad";
        return "status warn";
      }

      function setTokenStatus(text, status) {
        elements.tokenStatus.textContent = text;
        elements.tokenStatus.className = statusClass(status);
      }

      function setResultStatus(text, status) {
        elements.resultStatus.textContent = text;
        elements.resultStatus.className = statusClass(status);
      }

      function setScannerStatus(text, status) {
        if (!elements.scannerStatus) return;
        elements.scannerStatus.textContent = text;
        elements.scannerStatus.className = statusClass(status);
      }

      function setScannerControls(active) {
        if (elements.scannerStart) {
          elements.scannerStart.disabled = active;
        }
        if (elements.scannerStop) {
          elements.scannerStop.disabled = !active;
        }
      }

      function handleScannerResult(value) {
        if (!value) return;
        const now = Date.now();
        if (state.scanner.lastValue === value && now < state.scanner.cooldownUntil) {
          return;
        }
        state.scanner.lastValue = value;
        state.scanner.cooldownUntil = now + 1500;
        elements.leitorToken.value = value;
        setMessage(elements.scannerMsg, "QR lido. Token preenchido.", "ok");
        setScannerStatus("QR detectado", "ok");
      }

      function scanFrame() {
        if (!state.scanner.active) return;
        const video = elements.scannerVideo;
        const canvas = elements.scannerCanvas;
        if (!video || !canvas || !window.jsQR) return;
        const ctx = canvas.getContext("2d");
        if (video.readyState >= 2) {
          const width = video.videoWidth;
          const height = video.videoHeight;
          if (width && height) {
            if (canvas.width !== width || canvas.height !== height) {
              canvas.width = width;
              canvas.height = height;
            }
            ctx.drawImage(video, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);
            const result = window.jsQR(imageData.data, width, height, {
              inversionAttempts: "attemptBoth",
            });
            if (result && result.data) {
              handleScannerResult(result.data.trim());
            }
          }
        }
        state.scanner.rafId = requestAnimationFrame(scanFrame);
      }

      async function startScanner() {
        if (!elements.scannerVideo || !elements.scannerCanvas) return;
        if (!navigator.mediaDevices?.getUserMedia) {
          setScannerStatus("Camera indisponivel", "bad");
          setMessage(elements.scannerMsg, "Camera nao suportada neste navegador.", "bad");
          return;
        }
        if (!window.jsQR) {
          setScannerStatus("Leitor indisponivel", "bad");
          setMessage(elements.scannerMsg, "Leitor nao carregado. Recarregue a pagina.", "bad");
          return;
        }
        if (state.scanner.active) return;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          state.scanner.stream = stream;
          elements.scannerVideo.srcObject = stream;
          await elements.scannerVideo.play();
          state.scanner.active = true;
          state.scanner.lastValue = "";
          state.scanner.cooldownUntil = 0;
          setScannerControls(true);
          setScannerStatus("Camera ativa", "ok");
          setMessage(elements.scannerMsg, "Aponte para o QR para ler.", "muted");
          scanFrame();
        } catch (error) {
          setScannerControls(false);
          setScannerStatus("Camera bloqueada", "bad");
          const hint =
            window.location.protocol === "file:"
              ? "Abra em servidor local (http://localhost) para usar a camera."
              : "Permissao de camera negada ou indisponivel.";
          setMessage(elements.scannerMsg, hint, "bad");
        }
      }

      function stopScanner() {
        if (state.scanner.rafId) {
          cancelAnimationFrame(state.scanner.rafId);
          state.scanner.rafId = null;
        }
        if (state.scanner.stream) {
          state.scanner.stream.getTracks().forEach((track) => track.stop());
          state.scanner.stream = null;
        }
        if (elements.scannerVideo) {
          elements.scannerVideo.srcObject = null;
        }
        state.scanner.active = false;
        setScannerControls(false);
        setScannerStatus("Camera desligada", "warn");
      }

      function handleScannerFile(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!window.jsQR) {
          setScannerStatus("Leitor indisponivel", "bad");
          setMessage(elements.scannerMsg, "Leitor nao carregado. Recarregue a pagina.", "bad");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = elements.scannerCanvas;
            const ctx = canvas.getContext("2d");
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const result = window.jsQR(imageData.data, img.width, img.height, {
              inversionAttempts: "attemptBoth",
            });
            if (result && result.data) {
              handleScannerResult(result.data.trim());
            } else {
              setScannerStatus("QR nao encontrado", "warn");
              setMessage(elements.scannerMsg, "Nenhum QR encontrado na imagem.", "bad");
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
        event.target.value = "";
      }

      function randomNonce() {
        return Math.random().toString(36).slice(2, 10).toUpperCase();
      }

      function hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i += 1) {
          hash = (hash << 5) - hash + str.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash);
      }

      function mulberry32(seed) {
        let t = seed;
        return function () {
          t += 0x6d2b79f5;
          let r = Math.imul(t ^ (t >>> 15), 1 | t);
          r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
          return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
      }

      function renderQr(token) {
        const canvas = elements.qrCanvas;
        if (!canvas) return;
        if (window.QRious) {
          const options = {
            value: token,
            size: canvas.width,
            level: "M",
            foreground: "#0f172a",
            background: "#ffffff",
          };
          if (state.qrInstance && typeof state.qrInstance.set === "function") {
            state.qrInstance.set(options);
          } else {
            state.qrInstance = new window.QRious({ ...options, element: canvas });
          }
          return;
        }
        renderPseudoQR(token);
      }

      function renderPseudoQR(token) {
        const ctx = elements.qrCanvas.getContext("2d");
        const size = 21;
        const canvasSize = elements.qrCanvas.width;
        const cell = canvasSize / size;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        const rand = mulberry32(hashString(token));
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            const isFinder =
              (x < 5 && y < 5) ||
              (x > size - 6 && y < 5) ||
              (x < 5 && y > size - 6);
            if (isFinder || rand() > 0.6) {
              ctx.fillStyle = "#0f172a";
              ctx.fillRect(x * cell, y * cell, cell, cell);
            }
          }
        }
      }

      function base64Encode(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = "";
        bytes.forEach((b) => {
          binary += String.fromCharCode(b);
        });
        return btoa(binary);
      }

      function base64Decode(text) {
        const binary = atob(text);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      }

      async function signPayload(payload) {
        const base = JSON.stringify(payload) + QR_CHECKSUM_SALT;
        if (!window.crypto || !crypto.subtle || !crypto.subtle.digest) {
          const fallback = hashString(base).toString(16).padStart(8, "0");
          return `${fallback}${fallback}`.slice(0, 16);
        }
        const encoder = new TextEncoder();
        const data = encoder.encode(base);
        const hash = await crypto.subtle.digest("SHA-256", data);
        const bytes = Array.from(new Uint8Array(hash));
        return bytes.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
      }

      async function generateToken() {
        const funcionarioId = getCurrentFuncionarioId();
        const funcionario = getFuncionario(funcionarioId);
        const empresaId = funcionario?.empresaId || elements.empresaSelect.value;
        const postoId = elements.postoSelect.value;
        const valor = parseCurrencyInput(elements.valorInput.value);
        const paymentSource = "credito";
        const saldo = saldoFuncionario(funcionarioId);

        if (!funcionarioId || !funcionario || !isFuncionarioAtivo(funcionario)) {
          setMessage(elements.funcMsg, "Selecione um funcionario ativo.", "bad");
          return;
        }
        if (!valor || valor <= 0) {
          setMessage(elements.funcMsg, "Informe um valor valido.", "bad");
          return;
        }
        if (valor > saldo) {
          setMessage(elements.funcMsg, "Valor acima do saldo disponivel.", "bad");
          return;
        }

        const payload = {
          empresa_id: empresaId,
          funcionario_id: funcionarioId,
          posto_id: postoId,
          valor,
          payment_source: paymentSource,
          paymentSource,
          ts: Date.now(),
          nonce: randomNonce(),
        };
        const signature = await signPayload(payload);
        const token = `${base64Encode(JSON.stringify(payload))}.${signature}`;
        const expiresAt = payload.ts + state.validadeMs;
        state.currentToken = { token, payload, expiresAt, used: false };
        setMessage(elements.funcMsg, "QR Code gerado com sucesso.", "ok");
        const posto = getPosto(postoId);
        logEvent(
          "TOKEN_GERADO",
          `${funcionario?.nome || "--"} - ${formatBRL(valor)} - ${posto?.nome || "--"}`
        );
        renderToken();
      }

      function clearToken() {
        state.currentToken = null;
        elements.tokenValue.value = "";
        elements.tokenTimer.textContent = "--";
        setTokenStatus("Aguardando geracao", "warn");
        setMessage(elements.tokenMsg, "", "muted");
        renderQr("CREDTANK");
        if (state.timerId) {
          clearInterval(state.timerId);
          state.timerId = null;
        }
      }

      function renderToken() {
        if (!state.currentToken) {
          clearToken();
          return;
        }
        elements.tokenValue.value = state.currentToken.token;
        renderQr(state.currentToken.token);
        setTokenStatus("Ativo", "ok");
        updateCountdown();
        if (state.timerId) {
          clearInterval(state.timerId);
        }
        state.timerId = setInterval(updateCountdown, 1000);
      }

      function updateCountdown() {
        if (!state.currentToken || state.currentToken.used) return;
        const now = Date.now();
        const remaining = Math.max(0, state.currentToken.expiresAt - now);
        const seconds = Math.ceil(remaining / 1000);
        elements.tokenTimer.textContent = `${seconds}s`;
        if (remaining <= 0) {
          setTokenStatus("Expirado", "bad");
          setMessage(elements.tokenMsg, "QR expirou. Gere outro para continuar.", "bad");
          clearInterval(state.timerId);
          state.timerId = null;
        }
      }

      async function validateToken(rawToken, postoId) {
        const parts = rawToken.split(".");
        if (parts.length !== 2) {
          return { ok: false, reason: "Token invalido." };
        }
        let payload;
        try {
          payload = JSON.parse(base64Decode(parts[0]));
        } catch (err) {
          return { ok: false, reason: "Token corrompido." };
        }
        const signature = await signPayload(payload);
        if (signature !== parts[1]) {
          return { ok: false, reason: "Assinatura invalida." };
        }
        if (Date.now() > payload.ts + state.validadeMs) {
          return { ok: false, reason: "QR expirado." };
        }
        if (state.usedTokens.has(rawToken)) {
          return { ok: false, reason: "Token ja utilizado." };
        }
        if (payload.posto_id !== postoId) {
          return { ok: false, reason: "Token gerado para outro posto." };
        }
        if (
          !Object.prototype.hasOwnProperty.call(payload, "payment_source") &&
          !Object.prototype.hasOwnProperty.call(payload, "paymentSource")
        ) {
          return { ok: false, reason: "Token sem forma de pagamento. Gere um novo QR." };
        }
        const funcionario = getFuncionario(payload.funcionario_id);
        if (!funcionario) {
          return { ok: false, reason: "Funcionario nao encontrado." };
        }
        const paymentSource = normalizePaymentSource(payload.payment_source || payload.paymentSource);
        payload.payment_source = paymentSource;
        payload.paymentSource = paymentSource;
        if (paymentSource === "indefinido") {
          return { ok: false, reason: "Forma de pagamento invalida no token." };
        }
        if (payload.valor <= 0) {
          return { ok: false, reason: "Valor invalido." };
        }
        if (paymentSource !== "credito") {
          return { ok: false, reason: "Forma de pagamento desativada. Gere um novo QR." };
        }
        const saldo = saldoFuncionario(funcionario.id);
        if (payload.valor > saldo) {
          return { ok: false, reason: "Saldo insuficiente." };
        }
        return { ok: true, payload };
      }

      function registrarTransacao(payload, rawToken, combustivel) {
        const paymentSource = normalizePaymentSource(payload.payment_source || payload.paymentSource);
        const tx = {
          id: `TX-${Date.now().toString(36).toUpperCase()}`,
          funcionarioId: payload.funcionario_id,
          empresaId: payload.empresa_id,
          postoId: payload.posto_id,
          combustivel: combustivel || "",
          paymentSource,
          valor: payload.valor,
          timestamp: new Date(payload.ts),
          status: TX_STATUS.PENDING,
          aprovadoEm: new Date().toISOString(),
        };
        state.transacoes.unshift(tx);
        state.usedTokens.add(rawToken);
        const funcionario = getFuncionario(tx.funcionarioId);
        const posto = getPosto(tx.postoId);
        logEvent(
          "TRANSACAO_PENDENTE_CONFIRMACAO",
          `${tx.id} - ${funcionario?.nome || "--"} - ${posto?.nome || "--"} - ${formatBRL(tx.valor)} - ${paymentSourceLabel(paymentSource)}`
        );
        return tx;
      }

      function isTxPending(tx) {
        return tx?.status === TX_STATUS.PENDING;
      }

      function isTxConfirmed(tx) {
        return tx?.status === TX_STATUS.CONFIRMED;
      }

      function isTxDeclined(tx) {
        return tx?.status === TX_STATUS.DECLINED;
      }

      function txStatusLabel(tx) {
        if (tx?.status === TX_STATUS.DECLINED) return "Recusada";
        return isTxPending(tx) ? "Pendente" : "Confirmada";
      }

      function txStatusClass(tx) {
        if (tx?.status === TX_STATUS.DECLINED) return "bad";
        return isTxPending(tx) ? "warn" : "ok";
      }

      function findPendingTx(funcionarioId) {
        if (!funcionarioId) return null;
        return state.transacoes.find(
          (tx) => tx.funcionarioId === funcionarioId && tx.status === TX_STATUS.PENDING
        );
      }

      function hasVisibleModal() {
        return Boolean(document.querySelector(".modal:not(.hidden)"));
      }

      function setModalBodyLock(locked) {
        if (locked) {
          if (modalLockActive) return;
          modalLockScrollY = window.scrollY || window.pageYOffset || 0;
          modalLockActive = true;
          document.body.classList.add("modal-open");
          document.body.style.position = "fixed";
          document.body.style.top = `-${modalLockScrollY}px`;
          document.body.style.left = "0";
          document.body.style.right = "0";
          document.body.style.width = "100%";
          return;
        }
        if (!modalLockActive) return;
        modalLockActive = false;
        document.body.classList.remove("modal-open");
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        window.scrollTo(0, modalLockScrollY);
      }

      function updateModalScrollLock() {
        setModalBodyLock(hasVisibleModal());
      }

      function initModalScrollLock() {
        if (modalVisibilityObserver) {
          modalVisibilityObserver.disconnect();
          modalVisibilityObserver = null;
        }
        const modals = document.querySelectorAll(".modal");
        if (!modals.length) {
          setModalBodyLock(false);
          return;
        }
        modalVisibilityObserver = new MutationObserver(() => {
          updateModalScrollLock();
        });
        modals.forEach((modal) => {
          modalVisibilityObserver.observe(modal, {
            attributes: true,
            attributeFilter: ["class"],
          });
        });
        updateModalScrollLock();
      }

      function publishTxSignal(tx, eventName = "") {
        if (!tx || !tx.id) return;
        const signal = {
          id: tx.id,
          status: tx.status || "",
          event: String(eventName || ""),
          funcionarioId: tx.funcionarioId || "",
          empresaId: tx.empresaId || "",
          postoId: tx.postoId || "",
          ts: Date.now(),
        };
        let raw = "";
        try {
          raw = JSON.stringify(signal);
          localStorage.setItem(LAST_TX_KEY, raw);
        } catch (error) {
          raw = "";
        }
        if (raw) {
          lastPendingSignal = raw;
        }
        if (broadcastTxChannel) {
          broadcastTxChannel.postMessage({
            type: "tx_update",
            ...signal,
          });
        }
      }

      function parseTxSignal(raw) {
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") return parsed;
        } catch (error) {
        }
        return null;
      }

      function openConfirmModal(tx) {
        if (!elements.txConfirmModal || !tx) return;
        const posto = getPosto(tx.postoId);
        const paymentSource = normalizePaymentSource(tx.paymentSource || tx.payment_source);
        activeConfirmTxId = tx.id;
        elements.txConfirmAmount.textContent = formatBRL(tx.valor);
        elements.txConfirmPosto.textContent = posto?.nome || "--";
        elements.txConfirmId.textContent = tx.id;
        if (elements.txConfirmPaymentSource) {
          elements.txConfirmPaymentSource.textContent = paymentSourceLabel(paymentSource);
        }
        if (elements.txConfirmPassword) {
          elements.txConfirmPassword.value = "";
        }
        setMessage(elements.txConfirmMsg, "", "muted");
        elements.txConfirmModal.classList.remove("hidden");
        elements.txConfirmModal.setAttribute("aria-hidden", "false");
        if (elements.txConfirmPassword) {
          elements.txConfirmPassword.focus();
        }
      }

      function closeConfirmModal(snooze = false) {
        if (!elements.txConfirmModal) return;
        if (snooze) {
          confirmSnoozeUntil = Date.now() + 60000;
        }
        activeConfirmTxId = null;
        elements.txConfirmModal.classList.add("hidden");
        elements.txConfirmModal.setAttribute("aria-hidden", "true");
        lastPendingTxId = null;
        clearPendingPromptTimer();
      }

      function clearPendingPromptTimer() {
        if (pendingPromptTimer) {
          clearTimeout(pendingPromptTimer);
          pendingPromptTimer = null;
        }
        pendingPromptForId = "";
      }

      function schedulePendingPrompt(pending) {
        if (!pending || !pending.id) return;
        notifyPendingTransaction(pending);
        if (pendingPromptTimer && pendingPromptForId === pending.id) return;
        clearPendingPromptTimer();
        pendingPromptForId = pending.id;
        pendingPromptTimer = setTimeout(() => {
          pendingPromptTimer = null;
          if (!currentUser?.funcionarioId) return;
          const currentPending = findPendingTx(currentUser.funcionarioId);
          if (!currentPending || currentPending.id !== pendingPromptForId) {
            clearPendingPromptTimer();
            return;
          }
          if (Date.now() < confirmSnoozeUntil) return;
          if (activeConfirmTxId === currentPending.id && !elements.txConfirmModal.classList.contains("hidden")) {
            return;
          }
          openConfirmModal(currentPending);
        }, PENDING_PROMPT_DELAY_MS);
      }

      function maybePromptPendingConfirmation() {
        if (!currentUser) return;
        const funcionarioId = currentUser.funcionarioId;
        if (!funcionarioId) return;
        const pending = findPendingTx(funcionarioId);
        if (!pending) {
          clearPendingPromptTimer();
          closeConfirmModal(false);
          return;
        }
        if (pending.id !== lastPendingTxId) {
          lastPendingTxId = pending.id;
          confirmSnoozeUntil = 0;
          schedulePendingPrompt(pending);
          return;
        }
        if (Date.now() < confirmSnoozeUntil) return;
        if (activeConfirmTxId === pending.id && !elements.txConfirmModal.classList.contains("hidden")) {
          return;
        }
        openConfirmModal(pending);
      }

      function autoPromptPendingTx() {
        if (!currentUser) return;
        const funcionarioId = currentUser.funcionarioId;
        if (!funcionarioId) return;
        const pending = findPendingTx(funcionarioId);
        if (!pending) {
          clearPendingPromptTimer();
          lastPendingTxId = null;
          return;
        }
        if (lastPendingTxId !== pending.id) {
          lastPendingTxId = pending.id;
          confirmSnoozeUntil = 0;
          schedulePendingPrompt(pending);
          return;
        }
        if (Date.now() < confirmSnoozeUntil) return;
        if (activeConfirmTxId === pending.id && !elements.txConfirmModal.classList.contains("hidden")) {
          return;
        }
        openConfirmModal(pending);
      }

      async function handleConfirmSubmit() {
        if (!currentUser) return;
        const funcionarioId = currentUser.funcionarioId;
        if (!funcionarioId) return;
        const auth = getColaboradorAuthByFuncionarioId(funcionarioId);
        if (!auth) {
          setMessage(elements.txConfirmMsg, "Cadastro de acesso nao encontrado.", "bad");
          return;
        }
        if (!auth.senhaTransacao) {
          setMessage(
            elements.txConfirmMsg,
            "Defina sua senha de transacao em Configuracoes antes de confirmar.",
            "bad"
          );
          return;
        }
        const senha = elements.txConfirmPassword.value.trim();
        if (!senha) {
          setMessage(elements.txConfirmMsg, "Informe sua senha de transacao.", "bad");
          return;
        }
        if (!/^\d{4}$/.test(senha)) {
          setMessage(elements.txConfirmMsg, "Senha de transacao deve ter 4 digitos.", "bad");
          return;
        }
        if (auth.senhaTransacao !== senha) {
          setMessage(elements.txConfirmMsg, "Senha de transacao incorreta.", "bad");
          return;
        }
        const tx = state.transacoes.find((entry) => entry.id === activeConfirmTxId);
        if (!tx) {
          setMessage(elements.txConfirmMsg, "Transacao nao encontrada.", "bad");
          closeConfirmModal(false);
          return;
        }
        const paymentSource = normalizePaymentSource(tx.paymentSource || tx.payment_source);
        if (paymentSource === "indefinido") {
          setMessage(elements.txConfirmMsg, "Forma de pagamento indefinida. Recuse e gere novo QR.", "bad");
          return;
        }
        tx.status = TX_STATUS.CONFIRMED;
        tx.confirmadoEm = new Date().toISOString();
        const posto = getPosto(tx.postoId);
        const funcionario = getFuncionario(tx.funcionarioId);
        logEvent(
          "TRANSACAO_CONFIRMADA",
          `${tx.id} - ${funcionario?.nome || "--"} - ${posto?.nome || "--"} - ${formatBRL(tx.valor)} - ${paymentSourceLabel(paymentSource)}`
        );
        setMessage(elements.txConfirmMsg, "Transacao confirmada.", "ok");
        await queueStateSave(true);
        publishTxSignal(tx, "confirmada");
        refreshAllViews();
        setTimeout(() => {
          closeConfirmModal(false);
          maybePromptPendingConfirmation();
        }, 600);
      }

      async function handleConfirmReject() {
        if (!currentUser) return;
        const funcionarioId = currentUser.funcionarioId;
        if (!funcionarioId) return;
        const tx = state.transacoes.find((entry) => entry.id === activeConfirmTxId);
        if (!tx) {
          setMessage(elements.txConfirmMsg, "Transacao nao encontrada.", "bad");
          closeConfirmModal(false);
          return;
        }
        tx.status = TX_STATUS.DECLINED;
        tx.recusadoEm = new Date().toISOString();
        confirmSnoozeUntil = 0;
        const paymentSource = normalizePaymentSource(tx.paymentSource || tx.payment_source);
        const posto = getPosto(tx.postoId);
        const funcionario = getFuncionario(tx.funcionarioId);
        logEvent(
          "TRANSACAO_RECUSADA",
          `${tx.id} - ${funcionario?.nome || "--"} - ${posto?.nome || "--"} - ${formatBRL(tx.valor)} - ${paymentSourceLabel(paymentSource)}`
        );
        setMessage(elements.txConfirmMsg, "Transacao recusada.", "bad");
        await queueStateSave(true);
        publishTxSignal(tx, "recusada");
        refreshAllViews();
        setTimeout(() => {
          closeConfirmModal(false);
          maybePromptPendingConfirmation();
        }, 600);
      }

      function getTermsTarget() {
        if (!currentUser) return null;
        if (isColaboradorRole(currentUser.role) && currentUser.funcionarioId) {
          const byFuncionario = getColaboradorAuthByFuncionarioId(currentUser.funcionarioId);
          if (byFuncionario) return byFuncionario;
          const byAuthId = state.colaboradoresAuth.find((entry) => entry.id === currentUser.id);
          if (byAuthId) return byAuthId;
          const funcionario = getFuncionario(currentUser.funcionarioId);
          if (funcionario?.cpf) {
            return getColaboradorAuthByCpf(funcionario.cpf);
          }
        }
        if (currentUser.id) {
          const byId = state.usuarios.find((entry) => entry.id === currentUser.id);
          if (byId) return byId;
        }
        if (currentUser.email) {
          const byEmail = getUsuarioByEmailInsensitive(currentUser.email);
          if (byEmail) return byEmail;
        }
        return currentUser;
      }

      function openTermsModal() {
        if (!elements.termsModal) return;
        elements.termsModal.classList.remove("hidden");
        elements.termsModal.setAttribute("aria-hidden", "false");
        if (elements.termsCheck) {
          elements.termsCheck.checked = false;
        }
        if (elements.termsName) {
          elements.termsName.value = currentUser?.nome || "";
        }
        setMessage(elements.termsMsg, "", "muted");
      }

      function closeTermsModal() {
        if (!elements.termsModal) return;
        elements.termsModal.classList.add("hidden");
        elements.termsModal.setAttribute("aria-hidden", "true");
      }

      function maybeShowTerms() {
        if (!currentUser) return;
        const target = getTermsTarget();
        if (!target) return;
        if (target.termsAcceptedAt) {
          closeTermsModal();
          return;
        }
        openTermsModal();
      }

      async function handleTermsAccept() {
        const target = getTermsTarget();
        if (!target) {
          setMessage(elements.termsMsg, "Nao foi possivel validar o usuario. Refaca o login.", "bad");
          return;
        }
        const checked = elements.termsCheck ? elements.termsCheck.checked : false;
        const name = elements.termsName ? elements.termsName.value.trim() : "";
        if (!checked) {
          setMessage(elements.termsMsg, "Confirme a leitura do contrato para continuar.", "bad");
          return;
        }
        if (!name) {
          setMessage(elements.termsMsg, "Informe seu nome para assinatura.", "bad");
          return;
        }
        target.termsAcceptedAt = new Date().toISOString();
        target.termsName = name;
        logEvent("TERMO_ACEITO", `${name} (${roleLabel(currentUser?.role || "")})`);
        await queueStateSave(true);
        closeTermsModal();
      }

      function handleTermsDecline() {
        setMessage(elements.termsMsg, "Para acessar o sistema e necessario aceitar o contrato.", "warn");
        closeTermsModal();
        handleLogout();
      }

      function renderHomeTransacoes() {
        if (!elements.homeTransacoesList || !elements.homeTransacoesMsg) return;
        const funcionarioId = getCurrentFuncionarioId();
        const transacoes = funcionarioId
          ? state.transacoes.filter((tx) => tx.funcionarioId === funcionarioId)
          : [];
        elements.homeTransacoesList.innerHTML = "";
        if (!transacoes.length) {
          const empty = document.createElement("div");
          empty.className = "list-item muted";
          empty.textContent = "Nenhuma transacao registrada ainda.";
          elements.homeTransacoesList.appendChild(empty);
          elements.homeTransacoesMsg.textContent = "";
          return;
        }
        transacoes.slice(0, 3).forEach((tx) => {
          const posto = getPosto(tx.postoId);
          const paymentSource = normalizePaymentSource(tx.paymentSource || tx.payment_source);
          const item = document.createElement("div");
          const statusBadge = `<span class="tx-status ${txStatusClass(tx)}">${txStatusLabel(tx)}</span>`;
          item.className = `list-item ${isTxPending(tx) ? "pending" : ""}`;
          item.innerHTML = `
            <div class="tx-main">
              <span>${tx.id} - ${posto?.nome || "--"}</span>
              <span class="muted">${paymentSourceLabel(paymentSource)}</span>
              ${statusBadge}
            </div>
            <strong>${formatBRL(tx.valor)}</strong>
          `;
          elements.homeTransacoesList.appendChild(item);
        });
        elements.homeTransacoesMsg.textContent = "";
      }

      async function handlePasswordEmailResetRequest() {
        const funcionarioId = currentUser?.funcionarioId || "";
        if (!funcionarioId) {
          setMessage(elements.passwordMsg, "Funcao disponivel apenas para colaboradores.", "bad");
          return;
        }
        const funcionario = getFuncionario(funcionarioId);
        const auth = getColaboradorAuthByFuncionarioId(funcionarioId);
        const cpf = normalizeCpf(auth?.cpf || funcionario?.cpf || "");
        const email = normalizeEmail(auth?.email || funcionario?.email || "");
        if (!cpf) {
          setMessage(elements.passwordMsg, "CPF do colaborador nao encontrado.", "bad");
          return;
        }
        if (!email) {
          setMessage(elements.passwordMsg, "Cadastre um email de recuperacao antes de alterar a senha.", "bad");
          return;
        }
        if (elements.passwordEmailSend) elements.passwordEmailSend.disabled = true;
        try {
          const response = await fetch(API_PASSWORD_RESET_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "request_email_link", cpf }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            const code = String(payload?.error || "");
            const map = {
              email_not_found: "Este cadastro nao possui email de recuperacao.",
              mail_failed: "Nao foi possivel enviar o email agora.",
              mail_not_configured: "O envio de email ainda nao esta configurado no servidor.",
              colaborador_not_found: "Cadastro do colaborador nao encontrado.",
              db_write_failed: "Nao foi possivel registrar a solicitacao.",
            };
            setMessage(elements.passwordMsg, map[code] || "Nao foi possivel enviar o link de verificacao.", "bad");
            return;
          }
          if (elements.passwordEmailHint) {
            elements.passwordEmailHint.textContent = `Link enviado para ${payload.maskedDestination || maskEmail(email)}.`;
          }
          setMessage(elements.passwordMsg, "Link de verificacao enviado. Abra o email para definir a nova senha.", "ok");
        } catch (error) {
          setMessage(elements.passwordMsg, "Falha de conexao ao solicitar a troca de senha.", "bad");
        } finally {
          if (elements.passwordEmailSend) elements.passwordEmailSend.disabled = false;
        }
      }

      async function handleTxPinUpdate(event) {
        event.preventDefault();
        if (!elements.txPinForm) return;
        const context = getTxPinSecurityContext();
        if (!context || !context.funcionarioId || !context.auth) {
          setMessage(elements.txPinMsg, "Funcao disponivel apenas para colaboradores autenticados.", "bad");
          return;
        }
        const cpf = normalizeCpf(context.auth.cpf || context.funcionario?.cpf || "");
        const email = context.email;
        const newPin = elements.txPinNew ? elements.txPinNew.value.trim() : "";
        const confirmPin = elements.txPinConfirm ? elements.txPinConfirm.value.trim() : "";
        const verifyCode = String(elements.txPinCode ? elements.txPinCode.value.trim() : "").replace(/\D/g, "");
        if (!email) {
          setMessage(elements.txPinMsg, "Email de recuperacao nao cadastrado.", "bad");
          return;
        }
        if (!/^\d{4}$/.test(newPin)) {
          setMessage(elements.txPinMsg, "A senha de transacao deve ter exatamente 4 digitos.", "bad");
          return;
        }
        if (newPin !== confirmPin) {
          setMessage(elements.txPinMsg, "Confirmacao da senha de transacao nao confere.", "bad");
          return;
        }
        if (!/^\d{6}$/.test(verifyCode)) {
          setMessage(elements.txPinMsg, "Informe o codigo de 6 digitos enviado ao email.", "bad");
          return;
        }
        try {
          const response = await fetch(API_PASSWORD_RESET_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "apply_tx_pin_code",
              cpf,
              code: verifyCode,
              senhaTransacao: newPin,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            const error = String(payload?.error || "");
            const map = {
              code_invalid: "Codigo de verificacao invalido.",
              code_expired: "Codigo expirado. Solicite outro codigo.",
              invalid_transaction_pin: "A senha de transacao deve ter 4 digitos.",
              colaborador_not_found: "Cadastro do colaborador nao encontrado.",
              db_write_failed: "Nao foi possivel salvar a nova senha.",
            };
            setMessage(elements.txPinMsg, map[error] || "Nao foi possivel alterar a senha de transacao.", "bad");
            return;
          }
          context.auth.senhaTransacao = newPin;
          if (elements.txPinNew) elements.txPinNew.value = "";
          if (elements.txPinConfirm) elements.txPinConfirm.value = "";
          if (elements.txPinCode) elements.txPinCode.value = "";
          resetTxPinCodeState(false);
          setMessage(elements.txPinMsg, "Senha de transacao alterada apos verificacao do email.", "ok");
          await loadStateFromServer();
          updateTxPinCodeHint();
        } catch (error) {
          setMessage(elements.txPinMsg, "Falha de conexao ao alterar a senha de transacao.", "bad");
        }
      }

      function renderTransacoes() {
        const list = elements.transacoesList;
        list.innerHTML = "";
        if (state.transacoes.length === 0) {
          const empty = document.createElement("div");
          empty.className = "list-item muted";
          empty.textContent = "Sem transacoes registradas.";
          list.appendChild(empty);
          return;
        }
        state.transacoes.slice(0, 5).forEach((tx) => {
          const funcionario = getFuncionario(tx.funcionarioId);
          const posto = getPosto(tx.postoId);
          const paymentSource = normalizePaymentSource(tx.paymentSource || tx.payment_source);
          const item = document.createElement("div");
          const statusBadge = `<span class="tx-status ${txStatusClass(tx)}">${txStatusLabel(tx)}</span>`;
          item.className = `list-item ${isTxPending(tx) ? "pending" : ""}`;
          item.innerHTML = `
            <div class="tx-main">
              <div>${tx.id} - ${funcionario?.nome || "--"}</div>
              <div class="muted">${posto?.nome || "--"} | ${paymentSourceLabel(paymentSource)}</div>
            </div>
            <div class="tx-meta">
              <strong>${formatBRL(tx.valor)}</strong>
              ${statusBadge}
            </div>
          `;
          list.appendChild(item);
        });
        renderHomeTransacoes();
      }

      let empresaReportPage = 1;
      const EMPRESA_REPORT_PAGE_SIZE = 50;

      function renderEmpresaReportPagination(rows) {
        const tableBody = elements.empresaTable;
        if (!tableBody) return;
        const total = Array.isArray(rows) ? rows.length : 0;
        const pages = Math.max(1, Math.ceil(total / EMPRESA_REPORT_PAGE_SIZE));
        empresaReportPage = Math.min(Math.max(1, empresaReportPage), pages);
        tableBody.innerHTML = "";
        if (!total) {
          const row = document.createElement("tr");
          row.innerHTML = `<td colspan="5" class="muted">Sem dados no periodo.</td>`;
          tableBody.appendChild(row);
        } else {
          const start = (empresaReportPage - 1) * EMPRESA_REPORT_PAGE_SIZE;
          rows.slice(start, start + EMPRESA_REPORT_PAGE_SIZE).forEach((item) => {
            const row = document.createElement("tr");
            row.innerHTML = `<td>${escapeHtml(item[1] || "--")}</td><td>${escapeHtml(item[3] || "Sem contrato")}</td><td>${escapeHtml(item[4] || "Cidade não informada")}</td><td>${item[6] || 0}</td><td>${formatBRL(toNumberCellValue(item[7]) || 0)}</td>`;
            tableBody.appendChild(row);
          });
        }
        let pager = document.getElementById("empresa-report-pager");
        if (!pager) {
          pager = document.createElement("div");
          pager.id = "empresa-report-pager";
          pager.className = "report-pagination";
          const table = document.getElementById("empresa-table");
          table?.parentElement?.insertAdjacentElement("afterend", pager);
        }
        pager.innerHTML = `
          <span class="muted">Mostrando ${total ? ((empresaReportPage-1)*EMPRESA_REPORT_PAGE_SIZE+1) : 0}-${Math.min(empresaReportPage*EMPRESA_REPORT_PAGE_SIZE,total)} de ${total} colaboradores.</span>
          <div class="report-pagination-actions">
            <button class="btn ghost small" type="button" data-report-page="prev" ${empresaReportPage<=1?'disabled':''}>Anterior</button>
            <span class="status ok">Página ${empresaReportPage} de ${pages}</span>
            <button class="btn ghost small" type="button" data-report-page="next" ${empresaReportPage>=pages?'disabled':''}>Próxima</button>
          </div>`;
        pager.querySelector('[data-report-page="prev"]')?.addEventListener("click", () => { empresaReportPage--; renderEmpresaReportPagination(rows); });
        pager.querySelector('[data-report-page="next"]')?.addEventListener("click", () => { empresaReportPage++; renderEmpresaReportPagination(rows); });
      }

      function renderReports() {
        ensureReportPeriodDefaults();
        const { start: periodoInicio, end: periodoFim, label: periodoLabel } = resolveReportPeriod();
        elements.periodoLabel.textContent = `Referencia: ${periodoLabel}`;
        state.reportData.periodo = periodoLabel;
        setReportMessage("", "muted");
        const role = currentUser?.role === "colaborador" ? "funcionario" : currentUser?.role || "admin";

        document.querySelectorAll("[data-roles]").forEach((box) => {
          const allowed = box.dataset.roles.split(",");
          if (allowed.includes(role)) {
            box.classList.remove("hidden");
          } else {
            box.classList.add("hidden");
          }
        });
        updateReportExportOptions(role);

        let funcionarioId =
          role === "funcionario" && currentUser?.funcionarioId
            ? currentUser.funcionarioId
            : elements.relatorioFuncionario.value;
        if (role === "funcionario") {
          elements.relatorioFuncionario.value = funcionarioId || "";
          elements.relatorioFuncionario.disabled = true;
        } else if (role === "posto") {
          elements.relatorioFuncionario.disabled = true;
        } else {
          elements.relatorioFuncionario.disabled = false;
        }

        const empresaScopeId =
          role === "empresa" && currentUser?.empresaId
            ? currentUser.empresaId
            : role === "funcionario" && currentUser?.funcionarioId
              ? getFuncionario(currentUser.funcionarioId)?.empresaId
              : elements.relatorioEmpresaSelect.value || elements.empresaSelect.value;
        const transacoesPeriodo = state.transacoes.filter((tx) =>
          isWithinReportPeriod(tx.timestamp, periodoInicio, periodoFim)
        );
        let transacoesEmpresa = empresaScopeId
          ? transacoesPeriodo.filter((tx) => tx.empresaId === empresaScopeId)
          : transacoesPeriodo;
        if (role === "empresa" || role === "funcionario") {
          transacoesEmpresa = filterTransacoesByConvenio(transacoesEmpresa, empresaScopeId);
        }
        const postoUser = role === "posto" ? getPosto(currentUser?.postoId) : null;
        const transacoesBase = postoUser
          ? transacoesPeriodo.filter((tx) => tx.postoId === postoUser.id)
          : transacoesEmpresa;
        const transacoesEmpresaConfirmadas = transacoesEmpresa.filter((tx) => isTxConfirmed(tx));
        let transacoesBaseConfirmadas = transacoesBase.filter((tx) => isTxConfirmed(tx));
        // No posto, o relatorio e sempre consolidado por empresa: o posto enxerga apenas o que deve receber dele.
        if (role === "empresa") {
          elements.relatorioEmpresaSelect.value = empresaScopeId || "";
          elements.relatorioEmpresaSelect.disabled = true;
          const companyEmployees = state.funcionarios.filter((f) => f.empresaId === empresaScopeId);
          if (!companyEmployees.find((f) => f.id === funcionarioId)) {
            funcionarioId = companyEmployees[0]?.id;
            elements.relatorioFuncionario.value = funcionarioId || "";
          }
        } else if (role === "posto") {
          elements.relatorioEmpresaSelect.disabled = true;
        } else {
          elements.relatorioEmpresaSelect.disabled = false;
        }
        if (elements.relatorioFolhaEmpresa) {
          elements.relatorioFolhaEmpresa.value = empresaScopeId || "";
          elements.relatorioFolhaEmpresa.disabled = role === "empresa";
        }
        if (elements.relatorioEmpresaPostoWrap) {
          elements.relatorioEmpresaPostoWrap.classList.toggle("hidden", role !== "posto");
        }

        const transacoesExtrato =
          role === "admin" ? transacoesPeriodo.filter((tx) => isTxConfirmed(tx)) : transacoesEmpresaConfirmadas;
        const extratoTx = funcionarioId
          ? transacoesExtrato.filter((tx) => tx.funcionarioId === funcionarioId)
          : [];
        elements.extratoTable.innerHTML = "";
        if (extratoTx.length === 0) {
          const row = document.createElement("tr");
          row.innerHTML = `<td colspan="7" class="muted">Sem transações para este funcionário.</td>`;
          elements.extratoTable.appendChild(row);
        } else {
          extratoTx.forEach((tx) => {
            const posto = getPosto(tx.postoId);
            const row = document.createElement("tr");
            row.innerHTML = `<td>${tx.timestamp.toLocaleString("pt-BR")}</td><td>${
              escapeHtml(posto?.nome || "--")
            }</td><td>${escapeHtml(getPostoCidade(posto))}</td><td>${escapeHtml(tx.combustivel || "--")}</td><td>${
              escapeHtml(posto?.cnpj || "--")
            }</td><td>${formatBRL(tx.valor)}</td><td>${escapeHtml(tx.id || "--")}</td>`;
            elements.extratoTable.appendChild(row);
          });
        }
        const extratoTotal = extratoTx.reduce((sum, tx) => sum + tx.valor, 0);
        const funcionario = getFuncionario(funcionarioId);
        const empresaFuncionario = funcionario ? getEmpresa(funcionario.empresaId) : null;
        const empresaInfo = empresaFuncionario
          ? `Empresa: ${empresaFuncionario.nome}${empresaFuncionario.cnpj ? ` - CNPJ: ${empresaFuncionario.cnpj}` : ""}`
          : "Empresa: --";
        elements.extratoIdentificacao.textContent = funcionario
          ? `Funcionário: ${funcionario.nome} - CPF: ${funcionario.cpf} - Matrícula: ${funcionario.matricula} | Contrato: ${getFuncionarioContrato(funcionario)} | Cidade: ${getFuncionarioCidade(funcionario)} | ${empresaInfo}`
          : "Funcionário: --";
        elements.extratoTotal.textContent = `Total Geral: ${formatBRL(extratoTotal)}`;
        applyReportBrand(
          elements.reportLogoExtrato,
          elements.reportBrandNameExtrato,
          elements.reportBrandMetaExtrato,
          empresaFuncionario,
          periodoLabel
        );
        state.reportData.extrato = extratoTx.map((tx) => {
          const posto = getPosto(tx.postoId);
          return [
            tx.timestamp.toLocaleString("pt-BR"),
            posto?.nome || "--",
            getPostoCidade(posto),
            tx.combustivel || "--",
            posto?.cnpj || "--",
            formatDecimalForExport(tx.valor),
            tx.id,
          ];
        });
        state.reportData.funcionarioNome = funcionario?.nome || "";
        state.reportData.funcionarioMatricula = funcionario?.matricula || "";
        state.reportData.funcionarioCpf = funcionario?.cpf || "";
        state.reportData.funcionarioContrato = funcionario ? getFuncionarioContrato(funcionario) : "";
        state.reportData.funcionarioCidade = funcionario ? getFuncionarioCidade(funcionario) : "";
        state.reportData.extratoEmpresaNome = empresaFuncionario?.nome || "";
        state.reportData.extratoEmpresaCnpj = empresaFuncionario?.cnpj || "";

        const empresa = getEmpresa(empresaScopeId);
        const empresaNome = empresa?.nome || "--";
        const empresaCnpjLabel = empresa?.cnpj ? ` - CNPJ: ${empresa.cnpj}` : "";
        elements.empresaNome.textContent = `Empresa: ${empresaNome}${empresaCnpjLabel}`;
        applyReportBrand(
          elements.reportLogoEmpresa,
          elements.reportBrandNameEmpresa,
          elements.reportBrandMetaEmpresa,
          empresa,
          periodoLabel
        );
        if (role === "posto" && postoUser) {
          if (elements.reportLogoRepasse) {
            if (postoUser.logoData) {
              elements.reportLogoRepasse.src = postoUser.logoData;
              elements.reportLogoRepasse.classList.remove("hidden");
            } else {
              elements.reportLogoRepasse.removeAttribute("src");
              elements.reportLogoRepasse.classList.add("hidden");
            }
          }
          elements.reportBrandNameRepasse.textContent = `Posto: ${postoUser.nome || "--"}`;
          elements.reportBrandMetaRepasse.textContent = `Contas a receber de todas as empresas que abasteceram | Cidade: ${getPostoCidade(postoUser)} | Período: ${periodoLabel}`;
        } else {
          applyReportBrand(
            elements.reportLogoRepasse,
            elements.reportBrandNameRepasse,
            elements.reportBrandMetaRepasse,
            empresa,
            periodoLabel
          );
        }
        state.reportData.empresaNome = empresa?.nome || "";
        state.reportData.empresaCnpj = empresa?.cnpj || "";
        elements.empresaTable.innerHTML = "";
        let empresaTotal = 0;
        const empresaRows = [];
        const empresaStatsPorFuncionario = new Map();
        transacoesEmpresaConfirmadas.forEach((tx) => {
          const entry = empresaStatsPorFuncionario.get(tx.funcionarioId) || { count: 0, total: 0 };
          entry.count += 1;
          entry.total += Number(tx.valor || 0);
          empresaStatsPorFuncionario.set(tx.funcionarioId, entry);
        });
        state.funcionarios
          .filter((f) => f.empresaId === empresaScopeId)
          .forEach((func) => {
            const stats = empresaStatsPorFuncionario.get(func.id) || { count: 0, total: 0 };
            const total = stats.total;
            empresaTotal += total;
            const row = document.createElement("tr");
            row.innerHTML = `<td>${escapeHtml(func.nome || "--")}</td><td>${escapeHtml(getFuncionarioContrato(func))}</td><td>${escapeHtml(
              getFuncionarioCidade(func)
            )}</td><td>${stats.count}</td><td>${formatBRL(total)}</td>`;
            empresaRows.push([
              normalizeMatricula(func.matricula) || func.matricula || "",
              func.nome || "",
              normalizeCpf(func.cpf) || func.cpf || "",
              getFuncionarioContrato(func),
              getFuncionarioCidade(func),
              isFuncionarioAtivo(func) ? "Ativo" : "Inativo",
              String(stats.count),
              formatDecimalForExport(total),
            ]);
          });
        elements.empresaTotal.textContent = `Total Geral: ${formatBRL(empresaTotal)}`;
        state.reportData.empresa = empresaRows;
        renderEmpresaReportPagination(empresaRows);

        if (elements.folhaTable) {
          const empresaLabel = empresa?.nome || "--";
          const empresaCnpj = empresa?.cnpj ? ` - CNPJ: ${empresa.cnpj}` : "";
          if (elements.folhaIdentificacao) {
            elements.folhaIdentificacao.textContent = `Empresa: ${empresaLabel}${empresaCnpj}`;
          }
          if (elements.reportLogoFolha && elements.reportBrandNameFolha && elements.reportBrandMetaFolha) {
            applyReportBrand(
              elements.reportLogoFolha,
              elements.reportBrandNameFolha,
              elements.reportBrandMetaFolha,
              empresa,
              periodoLabel
            );
          }

          const totaisPorFuncionario = new Map();
          transacoesEmpresaConfirmadas.forEach((tx) => {
            const current = totaisPorFuncionario.get(tx.funcionarioId) || 0;
            totaisPorFuncionario.set(tx.funcionarioId, current + tx.valor);
          });

          elements.folhaTable.innerHTML = "";
          let folhaTotal = 0;
          let folhaColaboradores = 0;
          const folhaRows = [];
          state.funcionarios
            .filter((f) => f.empresaId === empresaScopeId)
            .forEach((func) => {
              const total = totaisPorFuncionario.get(func.id) || 0;
              if (total <= 0) return;
              folhaTotal += total;
              folhaColaboradores += 1;
              const row = document.createElement("tr");
              row.innerHTML = `<td>${escapeHtml(func.matricula || "--")}</td><td>${escapeHtml(func.nome || "--")}</td><td>${escapeHtml(
                func.cpf || "--"
              )}</td><td>${escapeHtml(getFuncionarioContrato(func))}</td><td>${escapeHtml(getFuncionarioCidade(func))}</td><td>${escapeHtml(
                empresaLabel
              )}</td><td>${escapeHtml(periodoLabel)}</td><td>${formatBRL(total)}</td>`;
              elements.folhaTable.appendChild(row);
              folhaRows.push([
                normalizeMatricula(func.matricula) || func.matricula || "",
                func.nome || "",
                normalizeCpf(func.cpf) || func.cpf || "",
                getFuncionarioContrato(func),
                getFuncionarioCidade(func),
                empresaLabel,
                periodoLabel,
                formatDecimalForExport(total),
              ]);
            });
          if (!elements.folhaTable.children.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="8" class="muted">Sem consumo no período.</td>`;
            elements.folhaTable.appendChild(row);
          }
          elements.folhaTotal.textContent = `Total Geral: ${formatBRL(folhaTotal)} | Colaboradores: ${folhaColaboradores}`;
          state.reportData.folha = folhaRows;
          state.reportData.folhaTotal = folhaTotal;
          state.reportData.folhaColaboradores = folhaColaboradores;
        }

        if (role === "posto" && postoUser) {
          elements.relatorioPostoSelect.value = postoUser.id;
          elements.relatorioPostoSelect.disabled = true;
          elements.relatorioPostoSelect.classList.add("hidden");
        } else {
          elements.relatorioPostoSelect.disabled = false;
          elements.relatorioPostoSelect.classList.remove("hidden");
        }
        const postoId = elements.relatorioPostoSelect.value;
        const postos =
          role === "posto" && postoUser
            ? [postoUser]
            : postoId && postoId !== "all"
              ? state.postos.filter((p) => p.id === postoId)
              : state.postos;
        elements.repasseTable.innerHTML = "";
        let repasseTotal = 0;
        const repasseRows = [];
        if (role === "posto" && postoUser) {
          if (elements.repasseCol1) elements.repasseCol1.textContent = "Empresa";
          if (elements.repasseCol2) elements.repasseCol2.textContent = "CNPJ";
          if (elements.repasseCol3) elements.repasseCol3.textContent = "Colaboradores";
          if (elements.repasseCol4) elements.repasseCol4.textContent = "Abastecimentos";
          if (elements.repasseCol5) elements.repasseCol5.textContent = "Total a receber";
          if (elements.repasseCol6) elements.repasseCol6.textContent = "Ultimo abastecimento";
          if (elements.repasseCol7) elements.repasseCol7.classList.add("hidden");
          if (elements.repasseCol8) elements.repasseCol8.classList.add("hidden");

          const empresaMap = new Map();
          transacoesBaseConfirmadas.forEach((tx) => {
            const empresaTx = getEmpresa(tx.empresaId);
            const key = tx.empresaId || "sem-empresa";
            const entry = empresaMap.get(key) || { empresa: empresaTx, txs: [], total: 0, colaboradores: new Set() };
            entry.txs.push(tx);
            entry.total += Number(tx.valor || 0);
            if (tx.funcionarioId) entry.colaboradores.add(tx.funcionarioId);
            empresaMap.set(key, entry);
          });

          const empresaResumo = Array.from(empresaMap.values()).sort((a,b) => b.total-a.total || String(a.empresa?.nome||"Sem empresa").localeCompare(String(b.empresa?.nome||"Sem empresa"),"pt-BR"));
          const totalPosto = empresaResumo.reduce((sum, e) => sum + e.total, 0);
          const txTotalPosto = empresaResumo.reduce((sum, e) => sum + e.txs.length, 0);
          if (elements.postoReportSummary) {
            elements.postoReportSummary.innerHTML = `
              <div class="kpi"><span class="muted">Empresas que abasteceram</span><strong>${empresaResumo.length}</strong></div>
              <div class="kpi"><span class="muted">Abastecimentos confirmados</span><strong>${txTotalPosto}</strong></div>
              <div class="kpi"><span class="muted">Total a receber</span><strong>${formatBRL(totalPosto)}</strong></div>`;
          }

          empresaResumo.forEach((entry) => {
            const empresaTx = entry.empresa;
            const txs = entry.txs.slice().sort((a,b) => b.timestamp-a.timestamp);
            const ultimo = txs[0]?.timestamp instanceof Date ? txs[0].timestamp.toLocaleString("pt-BR") : "--";
            const row = document.createElement("tr");
            row.innerHTML = `
              <td><strong>${escapeHtml(empresaTx?.nome || "Empresa não identificada")}</strong></td>
              <td>${escapeHtml(empresaTx?.cnpj || "--")}</td>
              <td>${entry.colaboradores.size}</td>
              <td>${txs.length}</td>
              <td><strong>${formatBRL(entry.total)}</strong></td>
              <td>${escapeHtml(ultimo)}</td>`;
            elements.repasseTable.appendChild(row);
            repasseRows.push([
              empresaTx?.nome || "Empresa não identificada",
              empresaTx?.cnpj || "--",
              String(entry.colaboradores.size),
              String(txs.length),
              formatDecimalForExport(entry.total),
              ultimo,
            ]);
          });
          if (!elements.repasseTable.children.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="6" class="muted">Nenhuma empresa realizou abastecimentos confirmados neste posto no periodo.</td>`;
            elements.repasseTable.appendChild(row);
          }
          elements.repasseTotal.textContent = `Total a receber do posto: ${formatBRL(totalPosto)} | Empresas: ${empresaResumo.length} | Abastecimentos: ${txTotalPosto}`;
          state.reportData.repassePostoNome = postoUser.nome || "--";
          state.reportData.repassePostoCidade = getPostoCidade(postoUser);
          state.reportData.repasseEmpresaFiltro = "Todas as empresas que abasteceram neste posto";
        } else {
          if (elements.repasseCol7) elements.repasseCol7.classList.add("hidden");
          if (elements.repasseCol8) elements.repasseCol8.classList.add("hidden");
          if (elements.repasseCol1) elements.repasseCol1.textContent = "Posto";
          if (elements.repasseCol2) elements.repasseCol2.textContent = "Cidade";
          if (elements.repasseCol3) elements.repasseCol3.textContent = "Contratos atendidos";
          if (elements.repasseCol4) elements.repasseCol4.textContent = "CNPJ";
          if (elements.repasseCol5) elements.repasseCol5.textContent = "Total a pagar";
          if (elements.repasseCol6) elements.repasseCol6.textContent = "Transações";
          postos.forEach((posto) => {
            const transacoesPosto = transacoesBaseConfirmadas.filter((tx) => tx.postoId === posto.id);
            const total = transacoesPosto.reduce((sum, tx) => sum + tx.valor, 0);
            const count = transacoesPosto.length;
            const contratos = Array.from(new Set(
              transacoesPosto.map((tx) => getFuncionarioContrato(getFuncionario(tx.funcionarioId)))
            )).sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ") || "Sem contrato";
            const cidade = getPostoCidade(posto);
            repasseTotal += total;
            const postoLogo = posto.logoData
              ? `<img class="table-logo" src="${posto.logoData}" alt="Logo do posto" />`
              : `<span class="table-logo placeholder">--</span>`;
            const row = document.createElement("tr");
            row.innerHTML = `<td><span class="table-brand">${postoLogo}<span>${escapeHtml(posto.nome || "--")}</span></span></td><td>${escapeHtml(
              cidade
            )}</td><td>${escapeHtml(contratos)}</td><td>${escapeHtml(posto.cnpj || "--")}</td><td>${formatBRL(total)}</td><td>${count}</td>`;
            elements.repasseTable.appendChild(row);
            repasseRows.push([
              posto.nome || "--",
              cidade,
              contratos,
              posto.cnpj || "--",
              formatDecimalForExport(total),
              String(count),
            ]);
          });
          if (!elements.repasseTable.children.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="6" class="muted">Sem postos cadastrados.</td>`;
            elements.repasseTable.appendChild(row);
          }
          elements.repasseTotal.textContent = `Total Geral: ${formatBRL(repasseTotal)}`;
        }
        state.reportData.repasseContext = role === "posto" && postoUser ? "posto-empresas" : "posto-resumo";
        state.reportData.repasse = repasseRows;
      }

      function updateResult(payload, status, message, combustivel = "", paymentSource = "") {
        const funcionario = payload ? getFuncionario(payload.funcionario_id) : null;
        const empresa = payload ? getEmpresa(payload.empresa_id) : null;
        setResultStatus(message, status);
        elements.resultAmount.textContent = payload ? formatBRL(payload.valor) : "R$ 0,00";
        const combustivelLabel = combustivel || payload?.combustivel || "";
        const combustivelText = combustivelLabel ? ` | Combustivel: ${combustivelLabel}` : "";
        const sourceText = payload
          ? ` | Pagamento: ${paymentSourceLabel(paymentSource || payload.payment_source || payload.paymentSource)}`
          : "";
        elements.resultDetails.textContent = payload
          ? `${funcionario?.nome || "--"} - ${empresa?.nome || "--"}${combustivelText}${sourceText}`
          : "Nenhuma transacao registrada ainda.";
      }

      function activateTab(tabName) {
        if (roleTabsCache.length && !roleTabsCache.includes(tabName)) {
          return;
        }
        const buttons = document.querySelectorAll(".tab-button[data-tab]");
        const panels = document.querySelectorAll(".tab-panel");
        buttons.forEach((btn) => btn.classList.remove("active"));
        panels.forEach((panel) => panel.classList.remove("active"));
        const activeButton = document.querySelector(`.tab-button[data-tab='${tabName}']`);
        if (activeButton) {
          activeButton.classList.add("active");
        }
        const activePanel = document.getElementById(`tab-${tabName}`);
        if (activePanel) {
          activePanel.classList.add("active");
        }
        document.querySelectorAll(".bank-nav-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.goTab === tabName);
        });
        if (tabName === "empresa") {
          activateEmpresaSection(activeEmpresaSection || "dashboard");
        }
        if (tabName !== "leitor") {
          stopScanner();
        }
      }

      function setupTabs() {
        const buttons = document.querySelectorAll(".tab-button[data-tab]");
        buttons.forEach((button) => {
          button.addEventListener("click", () => {
            activateTab(button.dataset.tab);
          });
        });
      }

      function setupPasswordToggles() {
        const toggles = document.querySelectorAll(".password-toggle");
        toggles.forEach((toggle) => {
          const targetId = toggle.dataset.target;
          if (!targetId) return;
          const input = document.getElementById(targetId);
          if (!input) return;
          toggle.addEventListener("click", () => {
            const reveal = input.type === "password";
            input.type = reveal ? "text" : "password";
            toggle.classList.toggle("active", reveal);
            const label = reveal ? "Ocultar senha" : "Exibir senha";
            toggle.setAttribute("aria-label", label);
            toggle.setAttribute("title", label);
          });
        });
      }

      function setupBankActions() {
        const buttons = document.querySelectorAll(".bank-nav-btn");
        buttons.forEach((button) => {
          button.addEventListener("click", (event) => {
            event.preventDefault();
            const target = button.dataset.goTab;
            const anchor = button.dataset.goAnchor;
            if (target) {
              activateTab(target);
            }
            if (anchor) {
              requestAnimationFrame(() => {
                const targetEl = document.getElementById(anchor);
                if (targetEl) {
                  targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              });
            }
          });
        });
      }

      function setupAdminTabs() {
        const buttons = document.querySelectorAll(".tab-button[data-admin-tab]");
        const panels = document.querySelectorAll(".admin-panel");
        buttons.forEach((button) => {
          button.addEventListener("click", () => {
            buttons.forEach((btn) => btn.classList.remove("active"));
            panels.forEach((panel) => panel.classList.remove("active"));
            button.classList.add("active");
            const panel = document.getElementById(`admin-${button.dataset.adminTab}`);
            if (panel) {
              panel.classList.add("active");
            }
          });
        });
      }

      function activateEmpresaSection(sectionName = "dashboard") {
        const buttons = document.querySelectorAll(".empresa-section-btn[data-empresa-tab]");
        const sections = document.querySelectorAll(".empresa-section[id^='empresa-section-']");
        if (!buttons.length || !sections.length) return;
        const available = Array.from(buttons).map((button) => button.dataset.empresaTab);
        const target = available.includes(sectionName) ? sectionName : "dashboard";
        activeEmpresaSection = target;
        buttons.forEach((button) => {
          button.classList.toggle("active", button.dataset.empresaTab === target);
        });
        sections.forEach((section) => {
          section.classList.toggle("active", section.id === `empresa-section-${target}`);
        });
      }

      function setupEmpresaTabs() {
        const buttons = document.querySelectorAll(".empresa-section-btn[data-empresa-tab]");
        buttons.forEach((button) => {
          button.addEventListener("click", () => activateEmpresaSection(button.dataset.empresaTab));
        });
      }

      function setAuthMessage(text, type = "muted") {
        setMessage(elements.loginMessage, text, type);
      }

      function setColabMessage(text, type = "muted") {
        setMessage(elements.colabMessage, text, type);
      }

      function setSettingsMessage(text, type = "muted") {
        setMessage(elements.settingsMsg, text, type);
      }

      function setAuthPanel(target) {
        const safeTarget = elements.authPanels[target] ? target : "corporativo";
        Object.entries(elements.authPanels).forEach(([key, panel]) => {
          if (!panel) return;
          panel.classList.toggle("active", key === safeTarget);
        });
        if (elements.authTabs && elements.authTabs.forEach) {
          elements.authTabs.forEach((tab) => {
            tab.classList.toggle("active", tab.dataset.auth === safeTarget);
          });
        }
        if (elements.authModeLabel) {
          const label = AUTH_PANEL_LABELS[safeTarget] || AUTH_PANEL_LABELS.corporativo;
          elements.authModeLabel.textContent = label;
        }
        if (safeTarget === "colaborador") {
          hydrateColabCpfForAutoBiometric();
          updateColabMode();
        }
        if (safeTarget === "maquininha" && elements.maquininhaCodigo) {
          updateMaquininhaPreview(elements.maquininhaCodigo.value);
        }
      }

      function isWebAuthnBiometricSupported() {
        if (IS_ANDROID_WEBVIEW_APP) return false;
        return window.isSecureContext && !!window.PublicKeyCredential && !!navigator.credentials;
      }

      function isNativeBiometricSupported() {
        return readNativeBridgeBoolean("isBiometricAvailable");
      }

      function isBiometricSupported() {
        return isWebAuthnBiometricSupported() || isNativeBiometricSupported();
      }

      function hasBiometricRegistration(auth) {
        const hasWebAuthnCreds = !!(auth && Array.isArray(auth.biometriaCredIds) && auth.biometriaCredIds.length);
        const hasNativeBiometric = !!(auth && auth.biometriaNativeAtiva);
        if (hasWebAuthnCreds && isWebAuthnBiometricSupported()) return true;
        if (IS_ANDROID_WEBVIEW_APP && hasWebAuthnCreds && isNativeBiometricSupported()) return true;
        if (hasNativeBiometric && isNativeBiometricSupported()) return true;
        return false;
      }

      function bufferToBase64Url(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      }

      function base64UrlToBuffer(base64url) {
        const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
        const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      }

      async function authenticateWebAuthnCredentials(credIds = []) {
        if (!isWebAuthnBiometricSupported()) return false;
        if (!Array.isArray(credIds) || !credIds.length) return false;
        const allowCredentials = credIds.map((id) => ({
          id: base64UrlToBuffer(id),
          type: "public-key",
        }));
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials,
            userVerification: "required",
            timeout: 60000,
          },
        });
        return true;
      }

      async function authenticateNativeBiometric(reason = "", context = "geral") {
        if (!isNativeBiometricSupported()) return false;
        const result = await callNativeBridgeAsync("authenticateBiometric", reason, context);
        return !!result?.ok;
      }

      function setColabMode(mode, hint = "") {
        if (!elements.colabForm) return;
        colabState.mode = mode;
        elements.colabForm.classList.toggle("register-mode", mode === "register");
        elements.colabSubmit.textContent = mode === "register" ? "Cadastrar" : "Entrar";
        if (elements.colabHint) {
          elements.colabHint.textContent =
            hint ||
            (mode === "register"
              ? "Primeiro acesso: senha com no minimo 6 caracteres."
              : "Use o CPF e senha do seu cadastro.");
        }
      }

      function resetColabEmailCodeState() {
        colabState.emailCode = "";
        colabState.emailCodeFor = "";
        colabState.emailCodeCpf = "";
        colabState.emailCodeExpiresAt = 0;
        if (elements.colabEmailCode) {
          elements.colabEmailCode.value = "";
        }
      }

      function resetTxPinCodeState(clearInput = true) {
        colabState.txPinCode = "";
        colabState.txPinCodeFor = "";
        colabState.txPinCodeFuncionarioId = "";
        colabState.txPinCodeExpiresAt = 0;
        colabState.txPinCodeSentAt = 0;
        if (clearInput && elements.txPinCode) {
          elements.txPinCode.value = "";
        }
      }

      function getTxPinSecurityContext() {
        const funcionarioId = currentUser?.funcionarioId || "";
        if (!funcionarioId) return null;
        const auth = getColaboradorAuthByFuncionarioId(funcionarioId);
        const funcionario = getFuncionario(funcionarioId);
        const email = normalizeEmail(auth?.email || funcionario?.email || "");
        return { funcionarioId, auth, funcionario, email };
      }

      function updateTxPinCodeHint() {
        if (!elements.txPinCodeHint) return;
        const context = getTxPinSecurityContext();
        if (!context) {
          elements.txPinCodeHint.textContent = "Envio de codigo vinculado ao email cadastrado.";
          return;
        }
        if (context.email) {
          elements.txPinCodeHint.textContent = `Codigo de verificacao enviado para ${maskEmail(context.email)}.`;
          return;
        }
        elements.txPinCodeHint.textContent = "Cadastre um email de recuperacao para habilitar esta verificacao.";
      }

      async function handleTxPinSendCode() {
        const context = getTxPinSecurityContext();
        if (!context || !context.auth) {
          setMessage(elements.txPinMsg, "Funcao disponivel apenas para colaboradores autenticados.", "bad");
          return;
        }
        if (Date.now() - Number(colabState.txPinCodeSentAt || 0) < 30000) {
          setMessage(elements.txPinMsg, "Aguarde alguns segundos para solicitar um novo codigo.", "warn");
          return;
        }
        const cpf = normalizeCpf(context.auth.cpf || context.funcionario?.cpf || "");
        if (!context.email || !cpf) {
          setMessage(elements.txPinMsg, "Email de recuperacao nao cadastrado para este colaborador.", "bad");
          updateTxPinCodeHint();
          return;
        }
        if (elements.txPinSendCode) elements.txPinSendCode.disabled = true;
        try {
          const response = await fetch(API_PASSWORD_RESET_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "request_tx_pin_code", cpf }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            const error = String(payload?.error || "");
            const map = {
              email_not_found: "Email de recuperacao nao cadastrado.",
              mail_failed: "Nao foi possivel enviar o codigo agora.",
              mail_not_configured: "O envio de email ainda nao esta configurado no servidor.",
              colaborador_not_found: "Cadastro do colaborador nao encontrado.",
              db_write_failed: "Nao foi possivel registrar o codigo.",
            };
            setMessage(elements.txPinMsg, map[error] || "Nao foi possivel enviar o codigo.", "bad");
            return;
          }
          colabState.txPinCodeSentAt = Date.now();
          if (elements.txPinCode) {
            elements.txPinCode.value = "";
            elements.txPinCode.focus();
          }
          if (elements.txPinCodeHint) {
            elements.txPinCodeHint.textContent = `Codigo enviado para ${payload.maskedDestination || maskEmail(context.email)}.`;
          }
          setMessage(elements.txPinMsg, "Codigo de verificacao enviado ao email cadastrado.", "ok");
          if (payload.debugCode && (DEMO_MODE || isLocalHost)) {
            setMessage(elements.txPinMsg, `Codigo de teste: ${payload.debugCode}`, "warn");
          }
        } catch (error) {
          setMessage(elements.txPinMsg, "Falha de conexao ao enviar o codigo.", "bad");
        } finally {
          if (elements.txPinSendCode) elements.txPinSendCode.disabled = false;
        }
      }

      async function handleColabSendEmailCode() {
        if (colabState.mode !== "register") {
          setColabMessage("Codigo de email disponivel somente no primeiro acesso.", "warn");
          return;
        }
        const email = normalizeEmail(elements.colabEmail ? elements.colabEmail.value.trim() : "");
        if (!email) {
          setColabMessage("Informe o email para enviar o codigo.", "bad");
          return;
        }
        const code = generateEmailCode();
        const funcionario = getFuncionarioByCpf(elements.colabCpf ? elements.colabCpf.value.trim() : "");
        const nome = funcionario?.nome || "Colaborador";
        const payload = {
          email,
          nome,
          code,
        };
        const cpf = normalizeCpf(elements.colabCpf ? elements.colabCpf.value.trim() : "");
        if (!cpf) {
          setColabMessage("Informe o CPF antes de solicitar o codigo de email.", "bad");
          return;
        }
        let sent = false;
        try {
          const response = await fetch(API_EMAIL_CODE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await response.json().catch(() => ({}));
          sent = !!(response.ok && data?.ok);
        } catch (error) {
          sent = false;
        }
        if (!sent) {
          if (DEMO_MODE || isLocalHost) {
            sent = true;
            setColabMessage(`Codigo de teste: ${code}`, "warn");
          } else {
            setColabMessage("Nao foi possivel enviar o codigo de email agora. Tente novamente.", "bad");
            return;
          }
        } else {
          setColabMessage("Codigo enviado para o email informado.", "ok");
        }
        colabState.emailCode = code;
        colabState.emailCodeFor = email;
        colabState.emailCodeCpf = cpf;
        colabState.emailCodeExpiresAt = Date.now() + 10 * 60 * 1000;
        if (elements.colabEmailCode) {
          elements.colabEmailCode.value = "";
          elements.colabEmailCode.focus();
        }
      }

      function updateBiometricLoginAvailability(auth) {
        if (!elements.colabBioLogin) return;
        const supported = isBiometricSupported();
        const canAttempt = canAttemptColabBiometric(auth);
        elements.colabBioLogin.disabled = !(supported && canAttempt);
        elements.colabBioLogin.classList.toggle("hidden", !supported);
      }

      function setColabBioToggleMessage(text, type = "muted") {
        if (!elements.colabBioToggleMsg) return;
        setMessage(elements.colabBioToggleMsg, text, type);
      }

      function isMobileBiometricAutoLoginContext() {
        return isTouchMobileViewport() || IS_ANDROID_WEBVIEW_APP;
      }

      function canAttemptNativeColabBiometric() {
        return IS_ANDROID_WEBVIEW_APP && isNativeBiometricSupported();
      }

      function canAttemptColabBiometric(auth) {
        if (!auth) return false;
        return hasBiometricRegistration(auth) || canAttemptNativeColabBiometric();
      }

      function readColabBiometricAutoMap() {
        try {
          const raw = localStorage.getItem(COLAB_BIO_AUTO_KEY);
          if (!raw) return {};
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") return {};
          return Object.entries(parsed).reduce((acc, [key, value]) => {
            const cpf = normalizeCpf(key);
            if (cpf && value === true) {
              acc[cpf] = true;
            }
            return acc;
          }, {});
        } catch (error) {
          return {};
        }
      }

      function writeColabBiometricAutoMap(map) {
        try {
          localStorage.setItem(COLAB_BIO_AUTO_KEY, JSON.stringify(map || {}));
          return true;
        } catch (error) {
          return false;
        }
      }

      function getColabBiometricAutoLoginPreference(cpf) {
        const normalizedCpf = normalizeCpf(cpf);
        if (!normalizedCpf) return false;
        const preferences = readColabBiometricAutoMap();
        return preferences[normalizedCpf] === true;
      }

      function setColabBiometricAutoLoginPreference(cpf, enabled) {
        if (!ALLOW_COLAB_AUTO_BIOMETRIC_LOGIN) {
          try {
            localStorage.removeItem(COLAB_BIO_AUTO_KEY);
            localStorage.removeItem(COLAB_BIO_AUTO_LAST_CPF_KEY);
          } catch (error) {
          }
          return false;
        }
        const normalizedCpf = normalizeCpf(cpf);
        if (!normalizedCpf) return false;
        const preferences = readColabBiometricAutoMap();
        if (enabled) {
          preferences[normalizedCpf] = true;
        } else {
          delete preferences[normalizedCpf];
        }
        const saved = writeColabBiometricAutoMap(preferences);
        if (!saved) return false;
        try {
          if (enabled) {
            localStorage.setItem(COLAB_BIO_AUTO_LAST_CPF_KEY, normalizedCpf);
          } else {
            const previousCpf = normalizeCpf(localStorage.getItem(COLAB_BIO_AUTO_LAST_CPF_KEY) || "");
            if (previousCpf === normalizedCpf) {
              localStorage.removeItem(COLAB_BIO_AUTO_LAST_CPF_KEY);
            }
          }
        } catch (error) {
        }
        return true;
      }

      function getLastColabBiometricAutoLoginCpf() {
        if (!ALLOW_COLAB_AUTO_BIOMETRIC_LOGIN) return "";
        try {
          return normalizeCpf(localStorage.getItem(COLAB_BIO_AUTO_LAST_CPF_KEY) || "");
        } catch (error) {
          return "";
        }
      }

      function hydrateColabCpfForAutoBiometric() {
        if (!ALLOW_COLAB_AUTO_BIOMETRIC_LOGIN) return;
        if (!elements.colabCpf || !isMobileBiometricAutoLoginContext()) return;
        const currentCpf = normalizeCpf(elements.colabCpf.value.trim());
        if (currentCpf) return;
        const storedCpf = getLastColabBiometricAutoLoginCpf();
        if (!storedCpf) return;
        if (!getColabBiometricAutoLoginPreference(storedCpf)) return;
        const auth = getColaboradorAuthByCpf(storedCpf);
        if (!auth || !hasBiometricRegistration(auth)) return;
        elements.colabCpf.value = formatCpfInput(storedCpf);
      }

      function syncColabBiometricAutoLoginControl(auth = null) {
        if (!elements.colabBioAutoOption || !elements.colabBioAutoCheck) return;
        if (!ALLOW_COLAB_AUTO_BIOMETRIC_LOGIN) {
          elements.colabBioAutoOption.classList.add("hidden");
          elements.colabBioAutoCheck.checked = false;
          elements.colabBioAutoCheck.disabled = true;
          try {
            localStorage.removeItem(COLAB_BIO_AUTO_KEY);
            localStorage.removeItem(COLAB_BIO_AUTO_LAST_CPF_KEY);
          } catch (error) {
          }
          return;
        }
        const mobileContext = isMobileBiometricAutoLoginContext();
        elements.colabBioAutoOption.classList.toggle("hidden", !mobileContext);
        if (!mobileContext) {
          elements.colabBioAutoCheck.checked = false;
          elements.colabBioAutoCheck.disabled = true;
          return;
        }
        const cpf = normalizeCpf(elements.colabCpf ? elements.colabCpf.value.trim() : "");
        const rememberedCpf = cpf || getLastColabBiometricAutoLoginCpf();
        const targetAuth = auth || (rememberedCpf ? getColaboradorAuthByCpf(rememberedCpf) : null);
        if (!targetAuth) {
          elements.colabBioAutoCheck.checked = false;
          elements.colabBioAutoCheck.disabled = true;
          return;
        }
        const supported = isBiometricSupported();
        const canAttempt = canAttemptColabBiometric(targetAuth);
        const enabled = getColabBiometricAutoLoginPreference(targetAuth.cpf);
        if (enabled && (!supported || !canAttempt)) {
          setColabBiometricAutoLoginPreference(targetAuth.cpf, false);
        }
        elements.colabBioAutoCheck.checked = enabled && supported && canAttempt;
        elements.colabBioAutoCheck.disabled = !supported;
      }

      async function maybeAutoStartColabBiometric(auth = null) {
        if (!ALLOW_COLAB_AUTO_BIOMETRIC_LOGIN) return false;
        if (colabState.autoBiometricRunning) return false;
        if (!isMobileBiometricAutoLoginContext()) return false;
        if (!elements.authPanels?.colaborador || !elements.authPanels.colaborador.classList.contains("active")) return false;
        if (colabState.mode !== "login") return false;

        let cpf = normalizeCpf(elements.colabCpf ? elements.colabCpf.value.trim() : "");
        const targetAuth = auth || (cpf ? getColaboradorAuthByCpf(cpf) : null);
        if (!targetAuth) return false;
        cpf = normalizeCpf(targetAuth.cpf || cpf);
        if (!cpf || !getColabBiometricAutoLoginPreference(cpf)) return false;
        if (!isBiometricSupported() || !canAttemptColabBiometric(targetAuth)) {
          setColabBiometricAutoLoginPreference(cpf, false);
          syncColabBiometricAutoLoginControl(targetAuth);
          return false;
        }
        if (colabState.autoBiometricAttemptCpf === cpf) return false;

        colabState.autoBiometricAttemptCpf = cpf;
        colabState.autoBiometricRunning = true;
        try {
          const authenticated = await handleBiometricLogin({ autoTrigger: true, cpfOverride: cpf });
          return !!authenticated;
        } catch (error) {
          return false;
        } finally {
          colabState.autoBiometricRunning = false;
        }
      }

      function updateColabBiometricToggleControl(auth = null) {
        if (!elements.colabBioToggleLogin) {
          syncColabBiometricAutoLoginControl(auth);
          return;
        }
        if (!IS_ANDROID_WEBVIEW_APP) {
          elements.colabBioToggleLogin.classList.add("hidden");
          setColabBioToggleMessage("", "muted");
          syncColabBiometricAutoLoginControl(auth);
          return;
        }

        elements.colabBioToggleLogin.classList.remove("hidden");
        const supported = isBiometricSupported();
        const cpf = normalizeCpf(elements.colabCpf ? elements.colabCpf.value.trim() : "");
        const targetAuth = auth || (cpf ? getColaboradorAuthByCpf(cpf) : null);
        const active = !!(targetAuth && hasBiometricRegistration(targetAuth));

        elements.colabBioToggleLogin.textContent = active
          ? "Desativar biometria nos proximos logins"
          : "Ativar biometria nos proximos logins";
        elements.colabBioToggleLogin.disabled = !supported || !targetAuth;

        if (!supported) {
          setColabBioToggleMessage("Biometria indisponivel neste dispositivo.", "warn");
          syncColabBiometricAutoLoginControl(targetAuth);
          return;
        }
        if (!targetAuth) {
          if (cpf) {
            setColabBioToggleMessage("Faca o primeiro login com senha para habilitar biometria.", "muted");
          } else {
            setColabBioToggleMessage("Informe o CPF para configurar biometria.", "muted");
          }
          syncColabBiometricAutoLoginControl(targetAuth);
          return;
        }
        setColabBioToggleMessage("", "muted");
        syncColabBiometricAutoLoginControl(targetAuth);
      }

      async function handleColabBiometricToggleLogin() {
        if (!IS_ANDROID_WEBVIEW_APP) {
          setColabBioToggleMessage("Funcao disponivel apenas no APK.", "warn");
          return;
        }

        const cpf = normalizeCpf(elements.colabCpf ? elements.colabCpf.value.trim() : "");
        if (!cpf) {
          setColabBioToggleMessage("Informe o CPF para configurar biometria.", "warn");
          return;
        }

        const auth = getColaboradorAuthByCpf(cpf);
        if (!auth) {
          setColabBioToggleMessage("Faca o primeiro login com senha antes de ativar biometria.", "warn");
          return;
        }

        if (!isBiometricSupported()) {
          if (canUseNativeBridge()) {
            callNativeBridgeAsync("openBiometricSettings");
          }
          setColabBioToggleMessage("Cadastre biometria no Android e tente novamente.", "warn");
          return;
        }

        const alreadyEnabled = hasBiometricRegistration(auth);
        if (alreadyEnabled) {
          auth.biometriaCredIds = [];
          auth.biometriaAtiva = false;
          auth.biometriaNativeAtiva = false;
          setColabBiometricAutoLoginPreference(auth.cpf, false);
          colabState.autoBiometricAttemptCpf = "";
          const saved = await queueStateSave(true);
          setColabBioToggleMessage(
            saved
              ? "Biometria desativada para os proximos logins."
              : `Biometria desativada localmente, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
            saved ? "ok" : "warn"
          );
          updateBiometricLoginAvailability(auth);
          updateColabBiometricToggleControl(auth);
          return;
        }

        try {
          let activated = false;
          if (isNativeBiometricSupported()) {
            const approved = await authenticateNativeBiometric(
              "Confirme sua biometria para ativar o login biometrico.",
              "ativar_biometria_login"
            );
            if (approved) {
              auth.biometriaNativeAtiva = true;
              activated = true;
            }
          }
          if (!activated) {
            throw new Error("native_biometric_unavailable");
          }
          auth.biometriaAtiva = true;
          auth.biometriaCredIds = Array.isArray(auth.biometriaCredIds) ? auth.biometriaCredIds : [];
          setColabBiometricAutoLoginPreference(auth.cpf, true);
          colabState.autoBiometricAttemptCpf = "";
          const saved = await queueStateSave(true);
          setColabBioToggleMessage(
            saved
              ? "Biometria ativada para os proximos logins."
              : `Biometria ativada localmente, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
            saved ? "ok" : "warn"
          );
          if (elements.colabBioAutoCheck && elements.colabBioAutoCheck.checked) {
            setColabBiometricAutoLoginPreference(auth.cpf, true);
            colabState.autoBiometricAttemptCpf = "";
          }
          updateBiometricLoginAvailability(auth);
          updateColabBiometricToggleControl(auth);
        } catch (error) {
          setColabBioToggleMessage("Nao foi possivel ativar a biometria neste dispositivo.", "bad");
          syncColabBiometricAutoLoginControl(auth);
        }
      }

      async function handleColabBiometricAutoLoginChange() {
        if (!elements.colabBioAutoCheck) return;
        if (!ALLOW_COLAB_AUTO_BIOMETRIC_LOGIN) {
          elements.colabBioAutoCheck.checked = false;
          elements.colabBioAutoCheck.disabled = true;
          setColabBioToggleMessage("Login automatico desativado por seguranca. Use a biometria manual.", "muted");
          syncColabBiometricAutoLoginControl();
          return;
        }
        const enabled = !!elements.colabBioAutoCheck.checked;
        const cpf = normalizeCpf(elements.colabCpf ? elements.colabCpf.value.trim() : "");

        if (!enabled) {
          if (cpf) {
            setColabBiometricAutoLoginPreference(cpf, false);
          }
          colabState.autoBiometricAttemptCpf = "";
          setColabBioToggleMessage("Login automatico com biometria desativado.", "muted");
          syncColabBiometricAutoLoginControl();
          return;
        }

        if (!isMobileBiometricAutoLoginContext()) {
          elements.colabBioAutoCheck.checked = false;
          setColabBioToggleMessage("Opcao disponivel apenas no celular.", "warn");
          return;
        }
        if (!cpf) {
          elements.colabBioAutoCheck.checked = false;
          setColabBioToggleMessage("Informe o CPF para ativar esta opcao.", "warn");
          return;
        }

        let auth = getColaboradorAuthByCpf(cpf);
        if (!auth) {
          elements.colabBioAutoCheck.checked = false;
          setColabBioToggleMessage("Faca o primeiro login com senha antes de ativar esta opcao.", "warn");
          return;
        }
        if (!isBiometricSupported()) {
          elements.colabBioAutoCheck.checked = false;
          if (canUseNativeBridge()) {
            callNativeBridgeAsync("openBiometricSettings");
          }
          setColabBioToggleMessage("Biometria indisponivel neste dispositivo.", "warn");
          return;
        }
        if (!auth || !canAttemptColabBiometric(auth)) {
          elements.colabBioAutoCheck.checked = false;
          setColabBiometricAutoLoginPreference(cpf, false);
          if (IS_ANDROID_WEBVIEW_APP) {
            setColabBioToggleMessage("Biometria nativa indisponivel. Cadastre a biometria no aparelho.", "warn");
          } else {
            setColabBioToggleMessage("Ative a biometria primeiro e tente novamente.", "warn");
          }
          syncColabBiometricAutoLoginControl(auth);
          return;
        }

        setColabBiometricAutoLoginPreference(auth.cpf, true);
        colabState.autoBiometricAttemptCpf = "";
        setColabBioToggleMessage("Login automatico com biometria ativado.", "ok");
        syncColabBiometricAutoLoginControl(auth);
        await maybeAutoStartColabBiometric(auth);
      }

      function updateColabMode() {
        if (!elements.colabCpf) return;
        const cpf = normalizeCpf(elements.colabCpf.value.trim());
        if (colabState.fotoCpf && colabState.fotoCpf !== cpf) {
          colabState.fotoData = "";
          colabState.fotoCpf = "";
          if (elements.colabFotoPreview) elements.colabFotoPreview.removeAttribute("src");
          if (elements.colabFotoPreviewWrap) elements.colabFotoPreviewWrap.classList.remove("active");
        }
        if (colabState.autoBiometricAttemptCpf && colabState.autoBiometricAttemptCpf !== cpf) {
          colabState.autoBiometricAttemptCpf = "";
        }
        if (colabState.emailCodeCpf && colabState.emailCodeCpf !== cpf) {
          resetColabEmailCodeState();
        }
        if (!cpf) {
          setColabMode("login", "Informe seu CPF para continuar.");
          resetColabEmailCodeState();
          setColabMessage("", "muted");
          updateBiometricLoginAvailability(null);
          updateColabBiometricToggleControl(null);
          return;
        }
        const funcionario = getFuncionarioByCpf(cpf);
        if (!funcionario) {
          setColabMode("login", "CPF nao encontrado na base de colaboradores.");
          resetColabEmailCodeState();
          setColabMessage("CPF nao encontrado na base de colaboradores.", "bad");
          updateBiometricLoginAvailability(null);
          updateColabBiometricToggleControl(null);
          return;
        }
        const auth = getColaboradorAuthByCpf(cpf);
        if (!auth) {
          setColabMode(
            "register",
            "Primeiro acesso: senha com no minimo 6 caracteres, confirme o email e envie a foto."
          );
          if (elements.colabEmail && !elements.colabEmail.value && funcionario.email) {
            elements.colabEmail.value = funcionario.email;
          }
          if (elements.colabTelefone && !elements.colabTelefone.value && funcionario.telefone) {
            elements.colabTelefone.value = funcionario.telefone;
          }
        } else {
          setColabMode("login", "Use o CPF e senha do seu cadastro.");
          resetColabEmailCodeState();
        }
        if (!isFuncionarioAtivo(funcionario)) {
          setColabMessage("Conta inativa. Acesso liberado apenas para consulta. QR bloqueado.", "warn");
        } else {
          setColabMessage("", "muted");
        }
        updateBiometricLoginAvailability(auth);
        updateColabBiometricToggleControl(auth);
        if (auth) {
          maybeAutoStartColabBiometric(auth);
        }
      }

      function setupTxBroadcast() {
        const shouldRetryTxSignal = (signal) => {
          const txId = String(signal?.id || signal?.txId || "");
          if (!txId) return false;
          const localTx = state.transacoes.find((entry) => entry.id === txId);
          if (!localTx) return true;
          const expectedStatus = String(signal?.status || "").trim();
          if (expectedStatus && localTx.status !== expectedStatus) {
            return true;
          }
          return false;
        };

        const handleTxSignal = (signal = null, attempt = 0) => {
          const syncedLocal = syncStateFromStorage();
          if (syncedLocal) {
            refreshAllViews();
            autoPromptPendingTx();
          }
          loadStateFromServer().then((changed) => {
            if (changed) {
              refreshAllViews();
            }
            autoPromptPendingTx();
            if (shouldRetryTxSignal(signal) && attempt < 4) {
              setTimeout(() => handleTxSignal(signal, attempt + 1), 900);
            }
          });
        };
        if (broadcastTxChannel) {
          broadcastTxChannel.addEventListener("message", (event) => {
            const payload = event?.data || {};
            if (payload.type !== "pending_tx" && payload.type !== "tx_update") return;
            handleTxSignal(payload);
          });
        }
        window.addEventListener("storage", (event) => {
          if (!event || event.key !== LAST_TX_KEY) return;
          const signal = parseTxSignal(event.newValue);
          if (event.newValue) {
            lastPendingSignal = event.newValue;
          }
          handleTxSignal(signal);
        });
        if (!pendingSignalTimer) {
          pendingSignalTimer = setInterval(() => {
            let raw = "";
            try {
              raw = localStorage.getItem(LAST_TX_KEY) || "";
            } catch (error) {
              raw = "";
            }
            if (!raw || raw === lastPendingSignal) return;
            lastPendingSignal = raw;
            handleTxSignal(parseTxSignal(raw));
          }, LOCAL_SIGNAL_POLL_MS);
        }
      }

      async function fetchPendingTx(funcionarioId) {
        const url = `${API_STATE_URL}?pending_for=${encodeURIComponent(funcionarioId)}&ts=${Date.now()}`;
        const response = await fetch(url, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return null;
        const payload = await response.json();
        return payload?.pending || null;
      }

      function startPendingWatcher() {
        if (pendingWatcher) {
          clearInterval(pendingWatcher);
          pendingWatcher = null;
        }
        pendingWatcherInProgress = false;
        if (!isColaboradorRole(currentUser?.role) || !currentUser?.funcionarioId) return;
        const runPendingTick = async () => {
          if (pendingWatcherInProgress) return;
          pendingWatcherInProgress = true;
          try {
            const pending = await fetchPendingTx(currentUser.funcionarioId);
            if (pending && pending.status === TX_STATUS.PENDING) {
              mergePendingTx(pending);
              refreshAllViews();
              autoPromptPendingTx();
            }
          } catch (error) {
          } finally {
            pendingWatcherInProgress = false;
          }
        };
        pendingWatcher = setInterval(runPendingTick, PENDING_WATCH_MS);
        runPendingTick();
      }

      function stopPendingWatcher() {
        if (pendingWatcher) {
          clearInterval(pendingWatcher);
          pendingWatcher = null;
        }
        pendingWatcherInProgress = false;
      }

      function openColabForgotModal() {
        if (!elements.colabForgotModal) return;
        elements.colabForgotModal.classList.remove("hidden");
        elements.colabForgotModal.setAttribute("aria-hidden", "false");
        if (elements.colabForgotCpf) {
          elements.colabForgotCpf.value = formatCpfInput(elements.colabCpf ? elements.colabCpf.value : "");
        }
        colabState.forgotPendingCpf = "";
        colabState.forgotPendingChannel = "email";
        colabState.forgotMaskedDestination = "--";
        setMessage(elements.colabForgotMsg, "", "muted");
        updateColabForgotChannelUi();
        updateColabForgotContactPreview();
      }

      function closeColabForgotModal() {
        if (!elements.colabForgotModal) return;
        elements.colabForgotModal.classList.add("hidden");
        elements.colabForgotModal.setAttribute("aria-hidden", "true");
      }

      function openColabResetModal(payload = {}) {
        if (!elements.colabResetModal) return;
        const token = String(payload.token || "").trim();
        if (!token) return;
        colabState.resetToken = token;
        colabState.resetTokenChannel = String(payload.channel || "");
        if (elements.colabResetContactMask) {
          elements.colabResetContactMask.textContent = String(payload.maskedDestination || "--");
        }
        if (elements.colabResetPassword) {
          elements.colabResetPassword.value = "";
        }
        if (elements.colabResetPasswordConfirm) {
          elements.colabResetPasswordConfirm.value = "";
        }
        setMessage(elements.colabResetMsg, "", "muted");
        elements.colabResetModal.classList.remove("hidden");
        elements.colabResetModal.setAttribute("aria-hidden", "false");
        if (elements.colabResetPassword) {
          elements.colabResetPassword.focus();
        }
      }

      function closeColabResetModal(clearToken = true) {
        if (!elements.colabResetModal) return;
        elements.colabResetModal.classList.add("hidden");
        elements.colabResetModal.setAttribute("aria-hidden", "true");
        if (elements.colabResetPassword) {
          elements.colabResetPassword.value = "";
        }
        if (elements.colabResetPasswordConfirm) {
          elements.colabResetPasswordConfirm.value = "";
        }
        if (clearToken) {
          colabState.resetToken = "";
          colabState.resetTokenChannel = "";
        }
      }

      function updateColabForgotChannelUi() {
        if (elements.colabForgotSendCode) {
          elements.colabForgotSendCode.textContent = "Enviar link por email";
        }
      }

      function updateColabForgotContactPreview() {
        const cpf = normalizeCpf(elements.colabForgotCpf ? elements.colabForgotCpf.value.trim() : "");
        if (!cpf) {
          if (elements.colabForgotContactMask) {
            elements.colabForgotContactMask.textContent = "--";
          }
          return;
        }
        const funcionario = getFuncionarioByCpf(cpf);
        let masked = "--";
        if (funcionario) {
          masked = funcionario.email ? maskEmail(funcionario.email) : "--";
        }
        if (elements.colabForgotContactMask) {
          elements.colabForgotContactMask.textContent = masked;
        }
      }

      async function handleColabForgotSendCode() {
        const cpf = normalizeCpf(elements.colabForgotCpf ? elements.colabForgotCpf.value.trim() : "");
        if (!cpf) {
          setMessage(elements.colabForgotMsg, "Informe o CPF cadastrado.", "bad");
          return;
        }
        const funcionario = getFuncionarioByCpf(cpf);
        if (!funcionario) {
          setMessage(elements.colabForgotMsg, "CPF nao encontrado na base de colaboradores.", "bad");
          return;
        }
        if (!normalizeEmail(funcionario.email)) {
          setMessage(elements.colabForgotMsg, "Este CPF nao possui email cadastrado para recuperacao.", "bad");
          return;
        }
        if (elements.colabForgotSendCode) {
          elements.colabForgotSendCode.disabled = true;
        }
        try {
          const response = await fetch(API_PASSWORD_RESET_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "request_email_link",
              cpf,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            const code = String(payload?.error || "");
            const map = {
              email_not_found: "Este CPF nao possui email cadastrado para recuperacao.",
              phone_not_found: "Este CPF nao possui telefone cadastrado para recuperacao.",
              mail_failed: "Falha ao enviar email. Tente novamente em instantes.",
              mail_not_configured:
                "Email nao configurado no servidor. Configure APP_SMTP_HOST, APP_SMTP_USER e APP_SMTP_PASS no arquivo api/config.php.",
              mail_connect_failed: "Nao foi possivel conectar no servidor SMTP. Verifique host/porta/firewall.",
              mail_starttls_failed: "Falha ao iniciar seguranca TLS no SMTP. Revise APP_SMTP_SECURE e porta.",
              mail_tls_failed: "Falha de criptografia TLS no SMTP. Revise APP_SMTP_SECURE e certificado.",
              mail_auth_failed: "Falha de autenticacao SMTP. Revise APP_SMTP_USER e APP_SMTP_PASS.",
              mail_from_rejected: "Remetente recusado pelo SMTP. Revise APP_MAIL_FROM.",
              mail_rcpt_rejected: "Destinatario rejeitado pelo SMTP. Verifique o email cadastrado do colaborador.",
              mail_from_invalid: "Configuracao de remetente invalida no servidor. Ajuste o email remetente.",
              sms_not_configured:
                "Telefone nao configurado no servidor. Defina APP_SMS_WEBHOOK_URL (gateway SMS/WhatsApp) em api/config.php.",
              sms_failed: "Falha ao enviar codigo por telefone. Tente novamente.",
              invalid_cpf: "CPF invalido para recuperacao.",
              colaborador_not_found: "CPF nao encontrado na base de colaboradores.",
              db_write_failed: "Falha ao registrar a solicitacao de recuperacao. Tente novamente.",
            };
            setMessage(
              elements.colabForgotMsg,
              map[code] || `Nao foi possivel enviar o link agora (erro: ${code || "desconhecido"}).`,
              "bad"
            );
            return;
          }
          if (elements.colabForgotContactMask) {
            elements.colabForgotContactMask.textContent = payload.maskedDestination || "--";
          }
          colabState.forgotPendingCpf = cpf;
          colabState.forgotPendingChannel = "email";
          colabState.forgotMaskedDestination = String(payload.maskedDestination || "--");
          setMessage(elements.colabForgotMsg, "Link de redefinicao enviado para o email cadastrado.", "ok");
          if (payload.debugCode && (DEMO_MODE || isLocalHost)) {
            setMessage(elements.colabForgotMsg, `Codigo de teste: ${payload.debugCode}`, "warn");
          }
          logEvent("COLABORADOR_RESET_LINK_ENVIADO", `${funcionario.nome} - ${cpf} - email`);
        } catch (error) {
          setMessage(elements.colabForgotMsg, "Falha de conexao ao enviar o link de redefinicao.", "bad");
        } finally {
          if (elements.colabForgotSendCode) {
            elements.colabForgotSendCode.disabled = false;
          }
        }
      }

      async function handleColabResetSubmit() {
        const token = String(colabState.resetToken || "").trim();
        const senha = elements.colabResetPassword ? elements.colabResetPassword.value.trim() : "";
        const senhaConfirm = elements.colabResetPasswordConfirm ? elements.colabResetPasswordConfirm.value.trim() : "";
        if (!token) {
          setMessage(elements.colabResetMsg, "Token de redefinicao invalido. Solicite novamente.", "bad");
          return;
        }
        if (!senha || !senhaConfirm) {
          setMessage(elements.colabResetMsg, "Informe e confirme a nova senha.", "bad");
          return;
        }
        const senhaRuleError = accessPasswordRuleError(senha);
        if (senhaRuleError) {
          setMessage(elements.colabResetMsg, senhaRuleError, "bad");
          return;
        }
        if (senha !== senhaConfirm) {
          setMessage(elements.colabResetMsg, "Confirmacao da senha nao confere.", "bad");
          return;
        }
        if (elements.colabResetOk) {
          elements.colabResetOk.disabled = true;
        }
        try {
          const response = await fetch(API_PASSWORD_RESET_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "apply_reset",
              token,
              senha,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            const error = String(payload?.error || "");
            const map = {
              invalid_password: "Senha invalida. Use no minimo 6 caracteres.",
              token_invalid: "Link/codigo invalido. Solicite nova recuperacao.",
              token_expired: "Link/codigo expirado. Solicite nova recuperacao.",
              colaborador_not_found: "Cadastro de colaborador nao encontrado.",
              db_write_failed: "Falha ao salvar a nova senha. Tente novamente.",
            };
            setMessage(elements.colabResetMsg, map[error] || "Nao foi possivel redefinir a senha.", "bad");
            return;
          }
          setMessage(elements.colabResetMsg, "Senha redefinida com sucesso.", "ok");
          setColabMessage("Senha redefinida. Entre com a nova senha.", "ok");
          logEvent("COLABORADOR_SENHA_REDEFINIDA", payload?.cpf || "token");
          setTimeout(() => {
            closeColabResetModal(true);
            setAuthPanel("colaborador");
            if (elements.colabSenha) {
              elements.colabSenha.value = "";
              elements.colabSenha.focus();
            }
          }, 700);
        } catch (error) {
          setMessage(elements.colabResetMsg, "Falha de conexao ao redefinir senha.", "bad");
        } finally {
          if (elements.colabResetOk) {
            elements.colabResetOk.disabled = false;
          }
        }
      }

      function clearResetTokenFromUrl() {
        try {
          const url = new URL(window.location.href);
          if (!url.searchParams.has("reset_token")) return;
          url.searchParams.delete("reset_token");
          const next = `${url.pathname}${url.search}${url.hash}`;
          window.history.replaceState({}, "", next);
        } catch (error) {
        }
      }

      async function handleResetTokenFromUrl() {
        let token = "";
        try {
          token = String(new URLSearchParams(window.location.search).get("reset_token") || "").trim();
        } catch (error) {
          token = "";
        }
        if (!token) return;
        try {
          const response = await fetch(API_PASSWORD_RESET_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "verify_token",
              token,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) {
            const error = String(payload?.error || "");
            const map = {
              token_invalid: "Link de redefinicao invalido. Solicite um novo.",
              token_expired: "Link de redefinicao expirado. Solicite um novo.",
            };
            setAuthPanel("colaborador");
            setColabMessage(map[error] || "Nao foi possivel validar o link de redefinicao.", "bad");
            return;
          }
          setAuthPanel("colaborador");
          setColabMessage("Link validado. Defina sua nova senha.", "ok");
          openColabResetModal({
            token,
            channel: String(payload.channel || "email"),
            maskedDestination: String(payload.maskedDestination || "--"),
          });
        } catch (error) {
          setAuthPanel("colaborador");
          setColabMessage("Falha de conexao ao validar o link de redefinicao.", "bad");
        } finally {
          clearResetTokenFromUrl();
        }
      }

      function updateTxRevealBioAvailability(auth) {
        if (!elements.txRevealBio) return;
        const supported = isBiometricSupported();
        const hasCreds = hasBiometricRegistration(auth);
        elements.txRevealBio.disabled = !(supported && hasCreds);
        elements.txRevealBio.classList.toggle("hidden", !supported);
      }

      function showTxRevealValue(auth) {
        if (!elements.txRevealValue) return;
        if (!auth?.senhaTransacao) {
          setMessage(elements.txRevealMsg, "Senha de transacao ainda nao cadastrada.", "bad");
          return;
        }
        elements.txRevealValue.value = auth.senhaTransacao;
        setMessage(elements.txRevealMsg, "Senha exibida por 15 segundos.", "ok");
        if (txRevealTimer) {
          clearTimeout(txRevealTimer);
        }
        txRevealTimer = setTimeout(() => {
          if (elements.txRevealValue) {
            elements.txRevealValue.value = TX_REVEAL_MASK;
          }
        }, 15000);
      }

      function handleTxRevealAccess() {
        if (!isColaboradorRole()) return;
        const auth = getColaboradorAuthByFuncionarioId(currentUser.funcionarioId);
        if (!auth) {
          setMessage(elements.txRevealMsg, "Cadastro de acesso nao encontrado.", "bad");
          return;
        }
        const senha = elements.txRevealAccess ? elements.txRevealAccess.value.trim() : "";
        if (!senha) {
          setMessage(elements.txRevealMsg, "Informe sua senha de acesso.", "bad");
          return;
        }
        if (auth.senha !== senha) {
          setMessage(elements.txRevealMsg, "Senha de acesso incorreta.", "bad");
          return;
        }
        if (elements.txRevealAccess) {
          elements.txRevealAccess.value = "";
        }
        showTxRevealValue(auth);
      }

      async function handleTxRevealBiometric() {
        if (!isColaboradorRole()) return;
        const auth = getColaboradorAuthByFuncionarioId(currentUser.funcionarioId);
        if (!auth) {
          setMessage(elements.txRevealMsg, "Cadastro de acesso nao encontrado.", "bad");
          return;
        }
        if (!isBiometricSupported()) {
          setMessage(elements.txRevealMsg, "Biometria indisponivel neste dispositivo.", "bad");
          return;
        }
        const hasWebCreds = Array.isArray(auth.biometriaCredIds) && auth.biometriaCredIds.length;
        let hasNative = !!auth.biometriaNativeAtiva;
        if (IS_ANDROID_WEBVIEW_APP && !hasNative && isNativeBiometricSupported()) {
          hasNative = true;
        }
        if (!hasWebCreds && !hasNative) {
          setMessage(elements.txRevealMsg, "Biometria nao cadastrada.", "bad");
          return;
        }
        try {
          let authenticated = false;
          if (hasWebCreds && isWebAuthnBiometricSupported()) {
            try {
              await authenticateWebAuthnCredentials(auth.biometriaCredIds);
              authenticated = true;
            } catch (webError) {
            }
          }
          if (!authenticated && hasNative && isNativeBiometricSupported()) {
            const approved = await authenticateNativeBiometric(
              "Confirme sua biometria para exibir a senha de transacao.",
              "tx_reveal"
            );
            if (!approved) {
              throw new Error("native_biometric_denied");
            }
            authenticated = true;
          }
          if (!authenticated) {
            throw new Error("biometric_context_unavailable");
          }
          showTxRevealValue(auth);
        } catch (error) {
          setMessage(elements.txRevealMsg, "Falha na autenticacao biometrica.", "bad");
        }
      }

      function handleValorInput() {
        if (!elements.valorInput) return;
        const formatted = formatCurrencyInput(elements.valorInput.value);
        elements.valorInput.value = formatted;
      }

      function collectColabRegisterDraft() {
        if (!elements.colabCpf || colabState.mode !== "register") return null;
        return {
          savedAt: Date.now(),
          cpf: elements.colabCpf.value || "",
          senha: elements.colabSenha?.value || "",
          senhaConfirm: elements.colabSenhaConfirm?.value || "",
          txPin: elements.colabTxPin?.value || "",
          txPinConfirm: elements.colabTxPinConfirm?.value || "",
          email: elements.colabEmail?.value || "",
          telefone: elements.colabTelefone?.value || "",
          emailCodeInput: elements.colabEmailCode?.value || "",
          emailCode: colabState.emailCode || "",
          emailCodeFor: colabState.emailCodeFor || "",
          emailCodeCpf: colabState.emailCodeCpf || "",
          emailCodeExpiresAt: Number(colabState.emailCodeExpiresAt || 0),
          fotoData:
            typeof colabState.fotoData === "string" && colabState.fotoData.length <= MAX_MEDIA_DATA_URI_CHARS
              ? colabState.fotoData
              : "",
          fotoCpf: colabState.fotoCpf || "",
        };
      }

      function scheduleColabRegisterDraftExpiry(delayMs = COLAB_REGISTER_DRAFT_TTL_MS) {
        if (colabRegisterDraftExpiryTimer) {
          clearTimeout(colabRegisterDraftExpiryTimer);
        }
        colabRegisterDraftExpiryTimer = setTimeout(() => {
          clearColabRegisterDraft();
        }, Math.max(1000, Number(delayMs || COLAB_REGISTER_DRAFT_TTL_MS)));
      }

      function saveColabRegisterDraft() {
        const draft = collectColabRegisterDraft();
        if (!draft) return;
        try {
          sessionStorage.setItem(COLAB_REGISTER_DRAFT_KEY, JSON.stringify(draft));
          scheduleColabRegisterDraftExpiry();
        } catch (error) {
        }
      }

      function clearColabRegisterDraft() {
        if (colabRegisterDraftExpiryTimer) {
          clearTimeout(colabRegisterDraftExpiryTimer);
          colabRegisterDraftExpiryTimer = null;
        }
        try {
          sessionStorage.removeItem(COLAB_REGISTER_DRAFT_KEY);
        } catch (error) {
        }
      }

      function restoreColabRegisterDraft() {
        let draft = null;
        try {
          const raw = sessionStorage.getItem(COLAB_REGISTER_DRAFT_KEY);
          if (!raw) return false;
          draft = JSON.parse(raw);
        } catch (error) {
          clearColabRegisterDraft();
          return false;
        }
        if (!draft || !draft.savedAt || Date.now() - Number(draft.savedAt) > COLAB_REGISTER_DRAFT_TTL_MS) {
          clearColabRegisterDraft();
          return false;
        }
        scheduleColabRegisterDraftExpiry(
          COLAB_REGISTER_DRAFT_TTL_MS - Math.max(0, Date.now() - Number(draft.savedAt))
        );
        const cpf = normalizeCpf(draft.cpf || "");
        if (!cpf || getColaboradorAuthByCpf(cpf)) {
          clearColabRegisterDraft();
          return false;
        }
        if (elements.colabCpf) elements.colabCpf.value = formatCpfInput(cpf);
        updateColabMode();
        if (colabState.mode !== "register") return false;
        if (elements.colabSenha) elements.colabSenha.value = String(draft.senha || "");
        if (elements.colabSenhaConfirm) elements.colabSenhaConfirm.value = String(draft.senhaConfirm || "");
        if (elements.colabTxPin) elements.colabTxPin.value = String(draft.txPin || "");
        if (elements.colabTxPinConfirm) elements.colabTxPinConfirm.value = String(draft.txPinConfirm || "");
        if (elements.colabEmail) elements.colabEmail.value = String(draft.email || "");
        if (elements.colabTelefone) elements.colabTelefone.value = String(draft.telefone || "");
        if (elements.colabEmailCode) elements.colabEmailCode.value = String(draft.emailCodeInput || "");
        if (
          draft.emailCode &&
          Date.now() <= Number(draft.emailCodeExpiresAt || 0) &&
          normalizeEmail(draft.emailCodeFor || "") === normalizeEmail(draft.email || "") &&
          normalizeCpf(draft.emailCodeCpf || "") === cpf
        ) {
          colabState.emailCode = String(draft.emailCode || "");
          colabState.emailCodeFor = normalizeEmail(draft.emailCodeFor || "");
          colabState.emailCodeCpf = cpf;
          colabState.emailCodeExpiresAt = Number(draft.emailCodeExpiresAt || 0);
        }
        const restoredPhoto = String(draft.fotoData || "");
        const restoredPhotoCpf = normalizeCpf(draft.fotoCpf || "");
        if (
          restoredPhoto &&
          restoredPhotoCpf === cpf &&
          restoredPhoto.length <= MAX_MEDIA_DATA_URI_CHARS &&
          /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(restoredPhoto)
        ) {
          colabState.fotoData = restoredPhoto;
          colabState.fotoCpf = cpf;
          if (elements.colabFotoPreview) elements.colabFotoPreview.src = restoredPhoto;
          if (elements.colabFotoPreviewWrap) elements.colabFotoPreviewWrap.classList.add("active");
        }
        setColabMessage("Cadastro restaurado. Seus dados foram preservados durante o uso da camera.", "ok");
        return true;
      }

      function stopColabCamera() {
        if (colabCameraStream) {
          colabCameraStream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch (error) {
            }
          });
        }
        colabCameraStream = null;
        if (elements.colabCameraVideo) {
          try {
            elements.colabCameraVideo.srcObject = null;
          } catch (error) {
          }
        }
        colabCameraBusy = false;
      }

      function closeColabCameraModal() {
        stopColabCamera();
        if (elements.colabCameraModal) {
          elements.colabCameraModal.classList.add("hidden");
          elements.colabCameraModal.setAttribute("aria-hidden", "true");
        }
        updateModalScrollLock();
      }

      async function startColabCamera() {
        if (!elements.colabCameraVideo || !navigator.mediaDevices?.getUserMedia) {
          if (elements.colabCameraOffline) elements.colabCameraOffline.classList.remove("hidden");
          setMessage(elements.colabCameraMsg, "Camera indisponivel neste navegador. Use Escolher foto.", "warn");
          return false;
        }
        stopColabCamera();
        if (elements.colabCameraOffline) elements.colabCameraOffline.classList.add("hidden");
        if (elements.colabCameraFrame) {
          elements.colabCameraFrame.classList.toggle("environment", colabCameraFacingMode === "environment");
        }
        setMessage(elements.colabCameraMsg, "Abrindo camera...", "muted");
        try {
          colabCameraStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: colabCameraFacingMode },
              width: { ideal: 960 },
              height: { ideal: 1280 },
            },
          });
          elements.colabCameraVideo.srcObject = colabCameraStream;
          await elements.colabCameraVideo.play().catch(() => {});
          setMessage(elements.colabCameraMsg, "Camera pronta. Centralize o rosto e toque em Tirar foto.", "ok");
          return true;
        } catch (error) {
          stopColabCamera();
          if (elements.colabCameraOffline) elements.colabCameraOffline.classList.remove("hidden");
          const denied = String(error?.name || "") === "NotAllowedError";
          setMessage(
            elements.colabCameraMsg,
            denied
              ? "Permissao da camera negada. Autorize a camera no navegador ou use Escolher foto."
              : "Nao foi possivel iniciar a camera. Use Escolher foto como alternativa.",
            "warn"
          );
          return false;
        }
      }

      async function openColabCameraModal() {
        if (colabState.mode !== "register") {
          setColabMessage("Informe primeiro o CPF do colaborador para iniciar o cadastro.", "warn");
          return;
        }
        saveColabRegisterDraft();
        if (!elements.colabCameraModal) return;
        elements.colabCameraModal.classList.remove("hidden");
        elements.colabCameraModal.setAttribute("aria-hidden", "false");
        updateModalScrollLock();
        await startColabCamera();
      }

      function compressCanvasPhotoData(sourceCanvas) {
        if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return "";
        let canvas = sourceCanvas;
        const qualities = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42];
        const tryBuild = (targetCanvas) => {
          let best = "";
          for (const quality of qualities) {
            try {
              best = targetCanvas.toDataURL("image/jpeg", quality);
            } catch (error) {
              best = "";
            }
            if (best && best.length <= MAX_MEDIA_DATA_URI_CHARS) break;
          }
          return best;
        };
        let candidate = tryBuild(canvas);
        let attempts = 0;
        while (candidate && candidate.length > MAX_MEDIA_DATA_URI_CHARS && attempts < 6) {
          attempts += 1;
          const next = document.createElement("canvas");
          next.width = Math.max(240, Math.round(canvas.width * 0.82));
          next.height = Math.max(240, Math.round(canvas.height * 0.82));
          const ctx = next.getContext("2d");
          if (!ctx) break;
          ctx.drawImage(canvas, 0, 0, next.width, next.height);
          canvas = next;
          candidate = tryBuild(canvas);
        }
        return candidate && candidate.length <= MAX_MEDIA_DATA_URI_CHARS ? candidate : "";
      }

      async function captureColabCameraPhoto() {
        if (colabCameraBusy || !elements.colabCameraVideo) return;
        const video = elements.colabCameraVideo;
        const sourceWidth = Number(video.videoWidth || 0);
        const sourceHeight = Number(video.videoHeight || 0);
        if (!sourceWidth || !sourceHeight) {
          setMessage(elements.colabCameraMsg, "A camera ainda esta carregando. Tente novamente.", "warn");
          return;
        }
        colabCameraBusy = true;
        try {
          const maxSide = 960;
          const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(sourceWidth * scale));
          canvas.height = Math.max(1, Math.round(sourceHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) throw new Error("canvas_unavailable");
          if (colabCameraFacingMode === "user") {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
          }
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const photoData = compressCanvasPhotoData(canvas);
          if (!photoData) throw new Error("photo_compress_failed");
          colabState.fotoData = photoData;
          colabState.fotoCpf = normalizeCpf(elements.colabCpf?.value || "");
          if (elements.colabFotoPreview) elements.colabFotoPreview.src = photoData;
          if (elements.colabFotoPreviewWrap) elements.colabFotoPreviewWrap.classList.add("active");
          setColabMessage("Foto pronta. Agora finalize o cadastro.", "ok");
          saveColabRegisterDraft();
          closeColabCameraModal();
        } catch (error) {
          setMessage(elements.colabCameraMsg, "Nao foi possivel capturar a foto. Tente novamente.", "bad");
        } finally {
          colabCameraBusy = false;
        }
      }

      async function switchColabCamera() {
        colabCameraFacingMode = colabCameraFacingMode === "user" ? "environment" : "user";
        await startColabCamera();
      }

      function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("photo_read_failed"));
          reader.readAsDataURL(file);
        });
      }

      function loadImageFromDataUrl(dataUrl) {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("photo_decode_failed"));
          image.src = dataUrl;
        });
      }

      async function normalizeColabPhotoData(file) {
        if (!file || !String(file.type || "").startsWith("image/")) return "";
        const original = await readFileAsDataUrl(file);
        if (!original) return "";
        if (original.length <= MAX_MEDIA_DATA_URI_CHARS) return original;

        const image = await loadImageFromDataUrl(original);
        const maxSide = 960;
        const width = image.naturalWidth || image.width || 1;
        const height = image.naturalHeight || image.height || 1;
        const scale = Math.min(1, maxSide / Math.max(width, height, 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        if (!context) return "";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return compressCanvasPhotoData(canvas);
      }

      async function handleColabPhotoChange() {
        const input = elements.colabFotoInput;
        if (!input || !elements.colabFotoPreview || !elements.colabFotoPreviewWrap) return;
        saveColabRegisterDraft();
        const file = input.files && input.files[0];
        if (!file) return;
        try {
          const photoData = await normalizeColabPhotoData(file);
          if (!photoData) {
            colabState.fotoData = "";
            colabState.fotoCpf = "";
            elements.colabFotoPreview.removeAttribute("src");
            elements.colabFotoPreviewWrap.classList.remove("active");
            setColabMessage("Nao foi possivel processar a foto. Tente outra imagem.", "bad");
            return;
          }
          colabState.fotoData = photoData;
          colabState.fotoCpf = normalizeCpf(elements.colabCpf?.value || "");
          elements.colabFotoPreview.src = colabState.fotoData;
          elements.colabFotoPreviewWrap.classList.add("active");
          saveColabRegisterDraft();
          setColabMessage("Foto pronta. Agora finalize o cadastro.", "ok");
        } catch (error) {
          colabState.fotoData = "";
          colabState.fotoCpf = "";
          elements.colabFotoPreview.removeAttribute("src");
          elements.colabFotoPreviewWrap.classList.remove("active");
          setColabMessage("Nao foi possivel ler a foto selecionada.", "bad");
        }
      }

      async function handleProfilePhotoUpload() {
        if (!elements.profileFotoInput || !elements.profileFotoMsg) return;
        if (!isColaboradorRole(currentUser?.role) || !currentUser?.funcionarioId) {
          setMessage(elements.profileFotoMsg, "Atualizacao de foto disponivel apenas para colaborador.", "warn");
          elements.profileFotoInput.value = "";
          return;
        }
        const funcionario = getFuncionario(currentUser.funcionarioId);
        if (!funcionario) {
          setMessage(elements.profileFotoMsg, "Cadastro do colaborador nao encontrado.", "bad");
          elements.profileFotoInput.value = "";
          return;
        }
        const file = elements.profileFotoInput.files && elements.profileFotoInput.files[0];
        if (!file) {
          setMessage(
            elements.profileFotoMsg,
            funcionario.fotoData ? "Foto atual mantida." : "Selecione uma imagem do colaborador.",
            funcionario.fotoData ? "muted" : "warn"
          );
          return;
        }
        try {
          const photoData = await normalizeColabPhotoData(file);
          if (!photoData) {
            setMessage(elements.profileFotoMsg, "Nao foi possivel processar a foto selecionada.", "bad");
            elements.profileFotoInput.value = "";
            return;
          }
          funcionario.fotoData = photoData;
          renderUserChip(currentUser);
          updateProfileInfo();
          setMessage(elements.profileFotoMsg, "Salvando foto no banco de dados...", "muted");

          let remotePhoto = await saveFuncionarioPhotoOnServer(funcionario.id, photoData);
          if (!remotePhoto.ok && !remotePhoto.skipped) {
            await new Promise((resolve) => setTimeout(resolve, 450));
            remotePhoto = await saveFuncionarioPhotoOnServer(funcionario.id, photoData);
          }

          if (remotePhoto.ok) {
            if (remotePhoto.data) {
              applyStateSnapshot(remotePhoto.data);
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(remotePhoto.data));
              } catch (error) {
              }
            }
            renderUserChip(currentUser);
            updateProfileInfo();
            setMessage(
              elements.profileFotoMsg,
              "Foto salva no banco de dados. Ela permanecera depois de sair e entrar novamente.",
              "ok"
            );
          } else if (remotePhoto.skipped && (DEMO_MODE || window.location.protocol === "file:")) {
            setMessage(elements.profileFotoMsg, "Foto atualizada apenas nesta demonstracao.", "warn");
          } else {
            setMessage(
              elements.profileFotoMsg,
              `Nao foi possivel salvar a foto no servidor (${remotePhoto.error || "erro_desconhecido"}). A foto nao sera considerada persistida ate o envio concluir.`,
              "bad"
            );
          }
        } catch (error) {
          setMessage(elements.profileFotoMsg, "Falha ao ler ou salvar o arquivo da foto.", "bad");
        } finally {
          elements.profileFotoInput.value = "";
        }
      }

      async function handleBiometricLogin(options = {}) {
        if (!elements.colabCpf) return false;
        const autoTrigger = !!(options && options.autoTrigger);
        let cpf = normalizeCpf(options?.cpfOverride || elements.colabCpf.value.trim());
        if (!cpf) {
          const savedSession = readSession();
          if (savedSession?.type === "colaborador") {
            cpf = normalizeCpf(savedSession.cpf || "");
          }
        }
        if (!cpf) {
          cpf = getLastColabBiometricAutoLoginCpf();
        }
        if (cpf && !normalizeCpf(elements.colabCpf.value.trim())) {
          elements.colabCpf.value = formatCpfInput(cpf);
        }
        if (!cpf) {
          if (!autoTrigger) {
            setColabMessage("Ative a biometria uma vez com CPF e senha; depois este dispositivo lembrara sua conta.", "bad");
          }
          return false;
        }

        const auth = getColaboradorAuthByCpf(cpf);
        if (!auth) {
          if (autoTrigger) {
            setColabBiometricAutoLoginPreference(cpf, false);
            syncColabBiometricAutoLoginControl(null);
          }
          setColabMessage("Biometria nao cadastrada para este CPF.", "bad");
          return false;
        }
        if (!isBiometricSupported()) {
          if (autoTrigger) {
            setColabBiometricAutoLoginPreference(auth.cpf, false);
            syncColabBiometricAutoLoginControl(auth);
          }
          setColabMessage("Biometria indisponivel neste dispositivo.", "bad");
          return false;
        }

        const hasWebCreds = Array.isArray(auth.biometriaCredIds) && auth.biometriaCredIds.length;
        let hasNative = !!auth.biometriaNativeAtiva;
        if (IS_ANDROID_WEBVIEW_APP && !hasNative && isNativeBiometricSupported()) {
          hasNative = true;
        }
        if (!hasWebCreds && !hasNative) {
          if (autoTrigger) {
            setColabBiometricAutoLoginPreference(auth.cpf, false);
            syncColabBiometricAutoLoginControl(auth);
          }
          setColabMessage("Biometria nao cadastrada para este CPF.", "bad");
          return false;
        }

        try {
          let authenticated = false;
          if (hasWebCreds && isWebAuthnBiometricSupported()) {
            try {
              await authenticateWebAuthnCredentials(auth.biometriaCredIds);
              authenticated = true;
            } catch (webError) {
            }
          }
          if (!authenticated && hasNative && isNativeBiometricSupported()) {
            const approved = await authenticateNativeBiometric(
              "Confirme sua biometria para acessar a conta.",
              "login_colaborador"
            );
            if (!approved) {
              throw new Error("native_biometric_denied");
            }
            authenticated = true;
          }
          if (!authenticated) {
            throw new Error("biometric_context_unavailable");
          }

          const funcionario = getFuncionario(auth.funcionarioId);
          if (!funcionario) {
            setColabMessage("Cadastro do colaborador nao encontrado.", "bad");
            return false;
          }

          const inactive = !isFuncionarioAtivo(funcionario);
          if (inactive) {
            setColabMessage("Conta inativa. QR bloqueado ate reativacao.", "warn");
          } else {
            setColabMessage("", "muted");
          }
          if (IS_ANDROID_WEBVIEW_APP && !auth.biometriaNativeAtiva && isNativeBiometricSupported()) {
            auth.biometriaNativeAtiva = true;
            auth.biometriaAtiva = true;
            queueStateSave(true);
          }
          saveSession({ type: "colaborador", cpf: auth.cpf }, getRememberPreference("colab"));
          showPortal(buildColaboradorUser(auth));
          return true;
        } catch (error) {
          if (autoTrigger) {
            setColabMessage("Biometria nao confirmada. Digite sua senha para entrar.", "warn");
          } else {
            setColabMessage("Falha na autenticacao biometrica.", "bad");
          }
          return false;
        }
      }

      async function handleBiometriaToggle() {
        if (!elements.bioToggle) return;
        if (!isColaboradorRole()) {
          elements.bioToggle.checked = false;
          return;
        }
        const auth = getColaboradorAuthByFuncionarioId(currentUser.funcionarioId);
        if (!auth) {
          setSettingsMessage("Cadastro de acesso nao encontrado.", "bad");
          elements.bioToggle.checked = false;
          return;
        }
        if (!isBiometricSupported()) {
          if (canUseNativeBridge()) {
            callNativeBridgeAsync("openBiometricSettings");
            setSettingsMessage("Cadastre biometria no Android e tente novamente.", "warn");
          } else {
            setSettingsMessage("Biometria indisponivel neste dispositivo.", "bad");
          }
          elements.bioToggle.checked = false;
          return;
        }
        if (!elements.bioToggle.checked) {
          auth.biometriaCredIds = [];
          auth.biometriaAtiva = false;
          auth.biometriaNativeAtiva = false;
          setColabBiometricAutoLoginPreference(auth.cpf, false);
          colabState.autoBiometricAttemptCpf = "";
          queueStateSave(true);
          setSettingsMessage("Biometria desativada.", "muted");
          updateBiometricLoginAvailability(auth);
          syncColabBiometricAutoLoginControl(auth);
          updateTxRevealBioAvailability(auth);
          return;
        }
        try {
          let activated = false;
          if (isWebAuthnBiometricSupported()) {
            try {
              const userId = new TextEncoder().encode(auth.funcionarioId || auth.cpf || "colaborador");
              const challenge = new Uint8Array(32);
              window.crypto.getRandomValues(challenge);
              const credential = await navigator.credentials.create({
                publicKey: {
                  challenge,
                  rp: { name: APP_NAME },
                  user: {
                    id: userId,
                    name: auth.cpf || "colaborador",
                    displayName: currentUser?.nome || "Colaborador",
                  },
                  pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                  authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
                  timeout: 60000,
                  attestation: "none",
                },
              });
              if (!credential) {
                throw new Error("credential");
              }
              const credId = bufferToBase64Url(credential.rawId);
              auth.biometriaCredIds = Array.isArray(auth.biometriaCredIds) ? auth.biometriaCredIds : [];
              if (!auth.biometriaCredIds.includes(credId)) {
                auth.biometriaCredIds.push(credId);
              }
              auth.biometriaNativeAtiva = false;
              activated = true;
            } catch (webError) {
            }
          }
          if (!activated && isNativeBiometricSupported()) {
            const approved = await authenticateNativeBiometric(
              "Confirme sua biometria para ativar o acesso biometrico.",
              "ativar_biometria"
            );
            if (!approved) {
              throw new Error("native_biometric_denied");
            }
            auth.biometriaCredIds = Array.isArray(auth.biometriaCredIds) ? auth.biometriaCredIds : [];
            auth.biometriaNativeAtiva = true;
            activated = true;
          }
          if (!activated) {
            throw new Error("biometric_context_unavailable");
          }
          auth.biometriaAtiva = true;
          setColabBiometricAutoLoginPreference(auth.cpf, true);
          colabState.autoBiometricAttemptCpf = "";
          queueStateSave(true);
          setSettingsMessage("Biometria ativada. Este dispositivo lembrara seu CPF nos proximos acessos.", "ok");
          updateBiometricLoginAvailability(auth);
          syncColabBiometricAutoLoginControl(auth);
          updateTxRevealBioAvailability(auth);
        } catch (error) {
          elements.bioToggle.checked = false;
          setSettingsMessage("Nao foi possivel ativar a biometria.", "bad");
          syncColabBiometricAutoLoginControl(auth);
        }
      }

      function syncBiometriaToggle() {
        if (!elements.bioToggle) return;
        if (!isColaboradorRole()) {
          elements.bioToggle.checked = false;
          elements.bioToggle.disabled = true;
          return;
        }
        if (!isBiometricSupported() && !canUseNativeBridge()) {
          elements.bioToggle.checked = false;
          elements.bioToggle.disabled = true;
          return;
        }
        const auth = getColaboradorAuthByFuncionarioId(currentUser.funcionarioId);
        const active = hasBiometricRegistration(auth);
        elements.bioToggle.disabled = !auth;
        elements.bioToggle.checked = active;
      }

      function syncColaboradorSettings() {
        const isFuncionario = isColaboradorRole();
        const auth = isFuncionario ? getCurrentColaboradorAuth() : null;
        const prefs = getColaboradorSettings(auth);

        if (isFuncionario && auth) {
          balanceHidden = !prefs.saldoVisivel;
        }

        if (elements.balanceVisibilityToggle) {
          elements.balanceVisibilityToggle.disabled = !isFuncionario || !auth;
          elements.balanceVisibilityToggle.checked = isFuncionario ? !!prefs.saldoVisivel : true;
        }

        if (elements.notifyToggle) {
          const notifySupported = isNotificationAvailableOnDevice();
          elements.notifyToggle.disabled = !isFuncionario || !auth || !notifySupported;
          elements.notifyToggle.checked = isFuncionario ? !!prefs.notificacoesAtivas && notifySupported : true;
        }
      }

      function parseSessionPayload(raw) {
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            return parsed;
          }
        } catch (error) {
          return { type: "usuario", id: raw };
        }
        return null;
      }

      function clearPersistedLoginSessions() {
        try {
          [SESSION_KEY, ...LEGACY_SESSION_KEYS].forEach((key) => localStorage.removeItem(key));
        } catch (error) {
        }
      }

      function readSessionStorageValue() {
        try {
          return (
            sessionStorage.getItem(SESSION_KEY) ||
            LEGACY_SESSION_KEYS.map((key) => sessionStorage.getItem(key)).find(Boolean) ||
            ""
          );
        } catch (error) {
          return "";
        }
      }

      function saveSession(payload) {
        const now = Date.now();
        const sessionPayload = {
          ...(payload || {}),
          authAt: now,
          lastUnlockAt: now,
          lastBackgroundAt: 0,
        };
        const serialized = JSON.stringify(sessionPayload);
        clearPersistedLoginSessions();
        try {
          LEGACY_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
          sessionStorage.setItem(SESSION_KEY, serialized);
        } catch (error) {
        }
      }

      function readSession() {
        clearPersistedLoginSessions();
        const raw = readSessionStorageValue();
        if (!raw) return null;
        const parsed = parseSessionPayload(raw);
        if (!parsed) return null;
        return parsed;
      }

      function updateStoredSessionMeta(updater) {
        if (typeof updater !== "function") return null;
        clearPersistedLoginSessions();
        const raw = readSessionStorageValue();
        if (!raw) return null;
        const parsed = parseSessionPayload(raw);
        if (!parsed) return null;
        const updated = updater({ ...parsed }) || parsed;
        const serialized = JSON.stringify(updated);
        try {
          LEGACY_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
          sessionStorage.setItem(SESSION_KEY, serialized);
        } catch (error) {
        }
        return updated;
      }

      function markSessionBackgrounded() {
        updateStoredSessionMeta((session) => {
          session.lastBackgroundAt = Date.now();
          return session;
        });
      }

      function markSessionUnlocked() {
        updateStoredSessionMeta((session) => {
          const now = Date.now();
          session.lastUnlockAt = now;
          session.lastBackgroundAt = 0;
          if (!session.authAt) {
            session.authAt = now;
          }
          return session;
        });
      }

      function isSessionExpiredForReauth(session) {
        if (!shouldEnforceSessionReauth()) return false;
        if (!session || typeof session !== "object") return true;
        const reference = Number(session.lastBackgroundAt || session.lastUnlockAt || session.authAt || 0);
        if (!reference || !Number.isFinite(reference)) return true;
        return Date.now() - reference > SESSION_REAUTH_MS;
      }

      function clearSession() {
        clearPersistedLoginSessions();
        try {
          [SESSION_KEY, ...LEGACY_SESSION_KEYS].forEach((key) => sessionStorage.removeItem(key));
        } catch (error) {
        }
      }

      function applyRoleAccess() {
        const role = currentUser?.role || "admin";
        const allowedTabs = {
          admin: ["abastecer", "relatorios", "admin"],
          empresa: ["empresa", "relatorios"],
          funcionario: ["home", "abastecer", "relatorios", "postos", "configuracoes"],
          colaborador: ["home", "abastecer", "relatorios", "postos", "configuracoes"],
          posto: ["posto", "relatorios"],
        };
        const roleTabs = allowedTabs[role] || allowedTabs.admin;
        roleTabsCache = roleTabs;
        document.body.classList.toggle("role-admin", role === "admin");
        document.body.classList.toggle("role-funcionario", role === "funcionario" || role === "colaborador");
        document.body.classList.toggle("role-posto", role === "posto");
        document.querySelectorAll(".tab-button[data-tab]").forEach((button) => {
          if (roleTabs.includes(button.dataset.tab)) {
            button.classList.remove("hidden");
          } else {
            button.classList.add("hidden");
          }
        });
        document.querySelectorAll(".bank-nav-btn").forEach((button) => {
          const tab = button.dataset.goTab;
          if (!tab) return;
          button.classList.toggle("hidden", !roleTabs.includes(tab));
        });

        if (elements.settingsGear) {
          elements.settingsGear.classList.toggle("hidden", !roleTabs.includes("configuracoes"));
        }

        elements.empresaSelect.disabled = false;
        elements.funcionarioSelect.disabled = false;
        elements.leitorPosto.disabled = false;
        elements.relatorioFuncionario.disabled = false;
        elements.relatorioEmpresaSelect.disabled = false;
        elements.relatorioPostoSelect.disabled = false;
        const isFuncionarioRole = role === "funcionario" || role === "colaborador";
        const empresaField = elements.empresaSelect ? elements.empresaSelect.closest(".field") : null;
        const funcionarioField = elements.funcionarioSelect ? elements.funcionarioSelect.closest(".field") : null;
        if (empresaField) {
          empresaField.classList.toggle("hidden", isFuncionarioRole);
        }
        if (funcionarioField) {
          funcionarioField.classList.toggle("hidden", isFuncionarioRole);
        }

        if (isFuncionarioRole) {
          const funcionario = getFuncionario(currentUser.funcionarioId);
          if (funcionario) {
            elements.empresaSelect.value = funcionario.empresaId;
            updateFuncionarioOptions();
            elements.funcionarioSelect.value = funcionario.id;
          }
          elements.empresaSelect.disabled = true;
          elements.funcionarioSelect.disabled = true;
          elements.relatorioFuncionario.value = currentUser.funcionarioId;
          elements.relatorioFuncionario.disabled = true;
        }

        if (role === "posto") {
          elements.empresaSelect.disabled = true;
          elements.funcionarioSelect.disabled = true;
          elements.postoSelect.disabled = true;
          elements.relatorioFuncionario.disabled = true;
          elements.relatorioEmpresaSelect.disabled = true;
          if (currentUser.postoId) {
            elements.relatorioPostoSelect.value = currentUser.postoId;
          }
          elements.relatorioPostoSelect.disabled = true;
        }

        if (elements.resetMonth) {
          elements.resetMonth.classList.toggle("hidden", role !== "admin");
        }
        const defaultTab = role === "admin" ? "admin" : role === "empresa" ? "empresa" : role === "posto" ? "posto" : "home";
        activateTab(defaultTab);
        if (role === "empresa") {
          activateEmpresaSection(activeEmpresaSection || "dashboard");
        }
        applyFuncionarioInativoState();
        updateTxPinCodeHint();
        runMobileEntryAnimation();
      }

      function applyFuncionarioInativoState() {
        const isFuncionario = currentUser?.role === "funcionario" || currentUser?.role === "colaborador";
        const funcionario = isFuncionario ? getFuncionario(currentUser.funcionarioId) : null;
        const inactive = isFuncionario && (!funcionario || !isFuncionarioAtivo(funcionario));
        elements.funcionarioInativoBanner.classList.toggle("hidden", !inactive);
        elements.postoSelect.disabled = inactive;
        elements.valorInput.disabled = inactive;
        elements.gerarToken.disabled = inactive;
        elements.copyToken.disabled = inactive;
        elements.clearToken.disabled = inactive;
        if (elements.tokenValue) {
          elements.tokenValue.disabled = inactive;
        }
        if (inactive) {
          setMessage(elements.funcMsg, "Conta inativa. Geracao de QR bloqueada.", "warn");
        } else if (elements.funcMsg?.textContent?.includes("Conta inativa")) {
          setMessage(elements.funcMsg, "", "muted");
        }
      }

      function roleLabel(role) {
        const labels = {
          admin: "Administrador",
          empresa: "Empresa",
          funcionario: "Colaborador",
          colaborador: "Colaborador",
          posto: "Posto",
        };
        return labels[role] || role;
      }

      function updateHeaderBrand() {
        if (!elements.companyChip) return;
        const setChipLogo = (src, altText) => {
          if (!elements.companyChipLogo) return;
          elements.companyChipLogo.src = src;
          elements.companyChipLogo.alt = altText || "Logo";
          elements.companyChipLogo.classList.remove("hidden");
          elements.companyChip.classList.add("has-logo");
          elements.companyChip.classList.remove("hidden");
          if (elements.companyChipName) {
            elements.companyChipName.textContent = altText || "";
          }
        };
        if (currentUser?.role === "admin") {
          elements.companyChip.classList.add("hidden");
          elements.companyChipLogo.removeAttribute("src");
          elements.companyChipLogo.classList.add("hidden");
          if (elements.funcionarioCompanyLogo) {
            elements.funcionarioCompanyLogo.removeAttribute("src");
            elements.funcionarioCompanyLogo.classList.add("hidden");
          }
          return;
        }
        if (currentUser?.role === "posto") {
          const posto = getPosto(currentUser.postoId);
          if (!posto) {
            elements.companyChip.classList.add("hidden");
            elements.companyChip.classList.remove("has-logo");
            elements.companyChipLogo.removeAttribute("src");
            elements.companyChipLogo.classList.add("hidden");
          } else {
            setChipLogo(posto.logoData || DEFAULT_COMPANY_CHIP_LOGO, posto.nome || "Posto");
          }
          if (elements.funcionarioCompanyLogo) {
            elements.funcionarioCompanyLogo.removeAttribute("src");
            elements.funcionarioCompanyLogo.classList.add("hidden");
          }
          return;
        }
        let empresa = null;
        if (currentUser?.role === "empresa") {
          empresa = getEmpresa(currentUser.empresaId);
        } else if (isColaboradorRole(currentUser?.role)) {
          const funcionario = getFuncionario(currentUser.funcionarioId);
          empresa = funcionario ? getEmpresa(funcionario.empresaId) : null;
        }
        if (!empresa && elements.empresaSelect?.value) {
          empresa = getEmpresa(elements.empresaSelect.value);
        }
        if (!empresa) {
          elements.companyChip.classList.add("hidden");
          elements.companyChip.classList.remove("has-logo");
          elements.companyChipLogo.removeAttribute("src");
          elements.companyChipLogo.classList.add("hidden");
          if (elements.funcionarioCompanyLogo) {
            elements.funcionarioCompanyLogo.removeAttribute("src");
            elements.funcionarioCompanyLogo.classList.add("hidden");
          }
          return;
        }
        setChipLogo(empresa.logoData || DEFAULT_COMPANY_CHIP_LOGO, empresa.nome || "Empresa");
        if (empresa.logoData) {
          if (elements.funcionarioCompanyLogo) {
            elements.funcionarioCompanyLogo.src = empresa.logoData;
            elements.funcionarioCompanyLogo.classList.remove("hidden");
          }
        } else {
          if (elements.funcionarioCompanyLogo) {
            elements.funcionarioCompanyLogo.removeAttribute("src");
            elements.funcionarioCompanyLogo.classList.add("hidden");
          }
        }
      }

      function setupBrandLogo() {
        if (!elements.brandLogo) return;
        elements.brandLogo.addEventListener("load", () => elements.brandLogo.classList.remove("hidden"));
        elements.brandLogo.addEventListener("error", () => elements.brandLogo.classList.add("hidden"));
        if (elements.brandLogo.complete && elements.brandLogo.naturalWidth > 0) {
          elements.brandLogo.classList.remove("hidden");
        }
      }

      function renderUserChip(user) {
        if (!elements.userChip) return;
        const name = formatDisplayName(user?.nome || "Usuario");
        const roleText = roleLabel(user?.role || "");
        const fragment = document.createDocumentFragment();
        if ((user?.role === "funcionario" || user?.role === "colaborador") && user?.funcionarioId) {
          const funcionario = getFuncionario(user.funcionarioId);
          const foto = funcionario?.fotoData || "";
          if (foto) {
            const img = document.createElement("img");
            img.className = "user-avatar";
            img.src = foto;
            img.alt = "Foto do colaborador";
            fragment.appendChild(img);
          }
        }
        const nameSpan = document.createElement("span");
        nameSpan.className = "user-chip-name";
        nameSpan.textContent = name;
        const roleSpan = document.createElement("span");
        roleSpan.className = "role-tag";
        roleSpan.textContent = roleText;
        elements.userChip.innerHTML = "";
        elements.userChip.appendChild(fragment);
        elements.userChip.appendChild(nameSpan);
        elements.userChip.appendChild(roleSpan);
      }

      function showPortal(user) {
        currentUser = user;
        restoreExpiredSessionInfo = null;
        lastVisibilityHiddenAt = 0;
        lastNotifiedPendingTxId = "";
        notificationBootstrapRequested = false;
        resetTxPinCodeState();
        elements.authScreen.classList.add("hidden");
        elements.portal.classList.remove("hidden");
        renderUserChip(user);
        syncSelects();
        applyRoleAccess();
        updateHeaderBrand();
        updateTxPinCodeHint();
        syncBiometriaToggle();
        refreshAllViews();
        maybeShowTerms();
        startPendingWatcher();
        bootstrapNotificationPermissionForCurrentUser();
        loadStateFromServer().then((changed) => {
          if (changed) {
            refreshAllViews();
          }
          maybeShowTerms();
        });
      }

      function handleLogin(event) {
        event.preventDefault();
        const email = elements.loginEmail.value.trim();
        const senha = elements.loginPassword.value.trim();
        if (!email || !senha) {
          setAuthMessage("Informe email e senha para entrar.", "bad");
          return;
        }
        const credentialMatches = getUsuariosByEmail(email).filter((entry) => entry.senha === senha);
        if (credentialMatches.length !== 1) {
          setAuthMessage("Credenciais invalidas. Tente novamente.", "bad");
          return;
        }
        const user = credentialMatches[0];
        saveSession({ type: "usuario", id: user.id, email: user.email || email }, getRememberPreference("user"));
        setAuthMessage("", "muted");
        showPortal(user);
      }

      async function handleColabSubmit(event) {
        event.preventDefault();
        const cpf = normalizeCpf(elements.colabCpf.value.trim());
        const senha = elements.colabSenha.value.trim();
        if (!cpf) {
          setColabMessage("Informe o CPF para continuar.", "bad");
          return;
        }
        const funcionario = getFuncionarioByCpf(cpf);
        if (!funcionario) {
          setColabMessage("CPF nao encontrado na base de colaboradores.", "bad");
          return;
        }
        const inactive = !isFuncionarioAtivo(funcionario);
        const auth = getColaboradorAuthByCpf(cpf);
        if (!auth) {
          const confirm = elements.colabSenhaConfirm ? elements.colabSenhaConfirm.value.trim() : "";
          const txPin = elements.colabTxPin ? elements.colabTxPin.value.trim() : "";
          const txPinConfirm = elements.colabTxPinConfirm ? elements.colabTxPinConfirm.value.trim() : "";
          const email = normalizeEmail(elements.colabEmail ? elements.colabEmail.value.trim() : "");
          const telefone = normalizeTelefone(elements.colabTelefone ? elements.colabTelefone.value.trim() : "");
          const emailCode = String(elements.colabEmailCode ? elements.colabEmailCode.value.trim() : "").replace(
            /\D/g,
            ""
          );
          if (!senha || !confirm) {
            setColabMessage("Informe e confirme a senha para o primeiro acesso.", "bad");
            return;
          }
          const senhaRuleError = accessPasswordRuleError(senha);
          if (senhaRuleError) {
            setColabMessage(senhaRuleError, "bad");
            return;
          }
          if (senha !== confirm) {
            setColabMessage("Confirmacao da senha nao confere.", "bad");
            return;
          }
          if (!txPin || !txPinConfirm) {
            setColabMessage("Informe e confirme a senha de transacao.", "bad");
            return;
          }
          if (!/^\d{4}$/.test(txPin)) {
            setColabMessage("Senha de transacao deve ter 4 digitos.", "bad");
            return;
          }
          if (txPin !== txPinConfirm) {
            setColabMessage("Confirmacao da senha de transacao nao confere.", "bad");
            return;
          }
          if (!email) {
            setColabMessage("Informe o email para recuperacao.", "bad");
            return;
          }
          if (!telefone) {
            setColabMessage("Informe o telefone para recuperacao.", "bad");
            return;
          }
          if (!colabState.emailCode || colabState.emailCodeFor !== email || colabState.emailCodeCpf !== cpf) {
            setColabMessage("Envie e confirme o codigo do email antes de continuar.", "bad");
            return;
          }
          if (Date.now() > colabState.emailCodeExpiresAt) {
            setColabMessage("Codigo de email expirado. Solicite um novo codigo.", "bad");
            resetColabEmailCodeState();
            return;
          }
          if (!/^\d{6}$/.test(emailCode) || emailCode !== colabState.emailCode) {
            setColabMessage("Codigo de confirmacao de email invalido.", "bad");
            return;
          }
          if (!colabState.fotoData || colabState.fotoCpf !== cpf) {
            setColabMessage("Envie uma foto para concluir o cadastro.", "bad");
            return;
          }
          setColabMessage("Salvando cadastro e foto...", "muted");
          const serverRegistration = await registerColaboradorOnServer({
            funcionarioId: funcionario.id,
            cpf,
            senha,
            senhaTransacao: txPin,
            email,
            telefone,
            fotoData: colabState.fotoData,
          });

          let newAuth = null;
          if (serverRegistration.ok && serverRegistration.data) {
            applyStateSnapshot(serverRegistration.data);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(serverRegistration.data));
            } catch (error) {
            }
            newAuth = getColaboradorAuthByCpf(cpf) || serverRegistration.auth || null;
          } else if (serverRegistration.skipped) {
            newAuth = {
              id: generateId("COL"),
              funcionarioId: funcionario.id,
              cpf,
              senha,
              senhaTransacao: txPin,
              biometriaCredIds: [],
              biometriaNativeAtiva: false,
            };
            state.colaboradoresAuth.push(newAuth);
            funcionario.fotoData = colabState.fotoData;
            funcionario.email = email;
            funcionario.telefone = telefone;
            await queueStateSave(true);
          } else {
            setColabMessage(
              `Nao foi possivel salvar o cadastro no servidor (${serverRegistration.error || "erro_desconhecido"}). Seus dados foram mantidos para tentar novamente.`,
              "bad"
            );
            saveColabRegisterDraft();
            return;
          }

          if (!newAuth) {
            setColabMessage("Cadastro salvo, mas nao foi possivel carregar o acesso. Atualize a pagina e tente entrar.", "warn");
            return;
          }

          clearColabRegisterDraft();
          saveSession({ type: "colaborador", cpf: newAuth.cpf }, getRememberPreference("colab"));
          setColabMessage(
            inactive ? "Conta inativa. QR bloqueado ate reativacao." : "",
            inactive ? "warn" : "muted"
          );
          showPortal(buildColaboradorUser(newAuth));
          if (elements.colabSenhaConfirm) {
            elements.colabSenhaConfirm.value = "";
          }
          if (elements.colabTxPin) {
            elements.colabTxPin.value = "";
          }
          if (elements.colabTxPinConfirm) {
            elements.colabTxPinConfirm.value = "";
          }
          if (elements.colabEmail) {
            elements.colabEmail.value = "";
          }
          if (elements.colabTelefone) {
            elements.colabTelefone.value = "";
          }
          if (elements.colabEmailCode) {
            elements.colabEmailCode.value = "";
          }
          resetColabEmailCodeState();
          elements.colabSenha.value = "";
          return;
        }
        if (!senha) {
          setColabMessage("Informe a senha para entrar.", "bad");
          return;
        }
        if (auth.senha !== senha) {
          setColabMessage("Credenciais invalidas. Tente novamente.", "bad");
          return;
        }
        saveSession({ type: "colaborador", cpf: auth.cpf }, getRememberPreference("colab"));
        setColabMessage(inactive ? "Conta inativa. QR bloqueado ate reativacao." : "", inactive ? "warn" : "muted");
        showPortal(buildColaboradorUser(auth));
      }

      function handleMaquininhaLogin(event) {
        event.preventDefault();
        if (!elements.maquininhaCodigo || !elements.maquininhaPin) return;
        const codigo = elements.maquininhaCodigo.value.trim();
        const posto = getPostoByCodigo(codigo);
        const pin = elements.maquininhaPin.value.trim();
        if (!codigo) {
          setMessage(elements.maquininhaMessage, "Informe o codigo da maquininha.", "bad");
          return;
        }
        if (!posto) {
          setMessage(elements.maquininhaMessage, "Codigo da maquininha nao encontrado.", "bad");
          return;
        }
        if (!pin || pin.length < 4) {
          setMessage(elements.maquininhaMessage, "Informe o codigo de acesso da maquininha.", "bad");
          return;
        }
        const acesso = String(posto.codigoAcesso || "").trim();
        if (!acesso) {
          setMessage(elements.maquininhaMessage, "Codigo de acesso nao cadastrado para esta maquininha.", "bad");
          return;
        }
        if (normalizeCodigo(pin) !== normalizeCodigo(acesso)) {
          setMessage(elements.maquininhaMessage, "Codigo de acesso incorreto.", "bad");
          return;
        }
        try {
          sessionStorage.setItem("maquininhaCodigo", codigo);
          sessionStorage.setItem("maquininhaPostoId", posto.id);
        } catch (error) {
          return;
        }
        updateMaquininhaPreview(codigo);
        setMessage(elements.maquininhaMessage, "", "muted");
        window.location.href = `leitor.html?posto=${encodeURIComponent(posto.id)}`;
      }

      function handleLogout() {
        stopPendingWatcher();
        lastNotifiedPendingTxId = "";
        notificationBootstrapRequested = false;
        clearSession();
        restoreExpiredSessionInfo = null;
        currentUser = null;
        elements.portal.classList.add("hidden");
        elements.authScreen.classList.remove("hidden");
        closeTermsModal();
        closeEmpresaFuncionarioProfile();
        closeColabForgotModal();
        closeColabResetModal(true);
        elements.loginPassword.value = "";
        elements.colabCpf.value = "";
        elements.colabSenha.value = "";
        if (elements.colabSenhaConfirm) {
          elements.colabSenhaConfirm.value = "";
        }
        if (elements.colabEmail) {
          elements.colabEmail.value = "";
        }
        if (elements.colabTelefone) {
          elements.colabTelefone.value = "";
        }
        if (elements.colabEmailCode) {
          elements.colabEmailCode.value = "";
        }
        if (elements.txPinAccess) {
          elements.txPinAccess.value = "";
        }
        if (elements.txPinCurrent) {
          elements.txPinCurrent.value = "";
        }
        if (elements.txPinNew) {
          elements.txPinNew.value = "";
        }
        if (elements.txPinConfirm) {
          elements.txPinConfirm.value = "";
        }
        if (elements.txPinCode) {
          elements.txPinCode.value = "";
        }
        if (elements.colabFotoInput) {
          elements.colabFotoInput.value = "";
        }
        if (elements.colabFotoPreview) {
          elements.colabFotoPreview.removeAttribute("src");
        }
        if (elements.colabFotoPreviewWrap) {
          elements.colabFotoPreviewWrap.classList.remove("active");
        }
        if (elements.funcionarioFotoBanner) {
          elements.funcionarioFotoBanner.classList.add("hidden");
        }
        colabState.fotoData = "";
        colabState.autoBiometricAttemptCpf = "";
        colabState.autoBiometricRunning = false;
        resetColabEmailCodeState();
        resetTxPinCodeState();
        updateTxPinCodeHint();
        updateHeaderBrand();
        setAuthMessage("", "muted");
        setColabMessage("", "muted");
        document.body.classList.remove("auth-locked");
        document.body.classList.remove("mobile-entry-running", "mobile-entry-ready");
        applyRoleHint();
        window.location.replace(`../login.html?v=${encodeURIComponent(APP_BUILD_VERSION)}`);
      }

      function forceSessionReauth(message = "Sessao expirada. Entre novamente.") {
        if (!currentUser) return;
        const previousRole = currentUser.role || "";
        const previousEmail = String(currentUser.email || "").trim();
        let previousCpf = "";
        if (isColaboradorRole(previousRole) && currentUser.funcionarioId) {
          previousCpf = getFuncionario(currentUser.funcionarioId)?.cpf || "";
        }
        stopPendingWatcher();
        lastNotifiedPendingTxId = "";
        notificationBootstrapRequested = false;
        clearSession();
        restoreExpiredSessionInfo = null;
        currentUser = null;
        elements.portal.classList.add("hidden");
        elements.authScreen.classList.remove("hidden");
        closeTermsModal();
        closeEmpresaFuncionarioProfile();
        closeColabForgotModal();
        closeColabResetModal(true);
        if (elements.loginPassword) {
          elements.loginPassword.value = "";
        }
        if (elements.colabSenha) {
          elements.colabSenha.value = "";
        }
        if (elements.colabSenhaConfirm) {
          elements.colabSenhaConfirm.value = "";
        }
        if (elements.colabEmailCode) {
          elements.colabEmailCode.value = "";
        }
        if (elements.txPinAccess) {
          elements.txPinAccess.value = "";
        }
        if (elements.txPinCurrent) {
          elements.txPinCurrent.value = "";
        }
        if (elements.txPinNew) {
          elements.txPinNew.value = "";
        }
        if (elements.txPinConfirm) {
          elements.txPinConfirm.value = "";
        }
        if (elements.txPinCode) {
          elements.txPinCode.value = "";
        }
        if (elements.colabFotoInput) {
          elements.colabFotoInput.value = "";
        }
        if (elements.colabFotoPreview) {
          elements.colabFotoPreview.removeAttribute("src");
        }
        if (elements.colabFotoPreviewWrap) {
          elements.colabFotoPreviewWrap.classList.remove("active");
        }
        if (elements.funcionarioFotoBanner) {
          elements.funcionarioFotoBanner.classList.add("hidden");
        }
        colabState.fotoData = "";
        colabState.autoBiometricAttemptCpf = "";
        colabState.autoBiometricRunning = false;
        resetColabEmailCodeState();
        resetTxPinCodeState();
        updateTxPinCodeHint();
        updateHeaderBrand();
        document.body.classList.remove("auth-locked");
        document.body.classList.remove("mobile-entry-running", "mobile-entry-ready");
        const targetPanel = isColaboradorRole(previousRole) ? "colaborador" : "corporativo";
        setAuthPanel(targetPanel);
        if (targetPanel === "colaborador") {
          if (elements.colabCpf) {
            elements.colabCpf.value = previousCpf ? formatCpfInput(previousCpf) : "";
            elements.colabCpf.focus();
          }
          updateColabMode();
          setColabMessage(message, "warn");
          setAuthMessage("", "muted");
          return;
        }
        if (elements.loginEmail) {
          elements.loginEmail.value = previousEmail;
        }
        if (elements.loginEmail) {
          elements.loginEmail.focus();
        }
        setAuthMessage(message, "warn");
        setColabMessage("", "muted");
      }

      function restoreSession() {
        restoreExpiredSessionInfo = null;
        const session = readSession();
        if (!session) return false;
        if (isSessionExpiredForReauth(session)) {
          restoreExpiredSessionInfo = {
            type: String(session.type || "usuario"),
            cpf: String(session.cpf || ""),
            email: String(session.email || ""),
          };
          clearSession();
          return false;
        }
        if (session.type === "usuario") {
          const user = state.usuarios.find((u) => u.id === session.id);
          if (user) {
            markSessionUnlocked();
            showPortal(user);
            return true;
          } else {
            clearSession();
          }
          return false;
        }
        if (session.type === "colaborador") {
          const sessionCpf =
            session.cpf || (session.matricula ? getFuncionarioByMatricula(session.matricula)?.cpf : "");
          const auth = sessionCpf ? getColaboradorAuthByCpf(sessionCpf) : null;
          if (auth) {
            markSessionUnlocked();
            showPortal(buildColaboradorUser(auth));
            return true;
          } else {
            clearSession();
          }
        }
        return false;
      }

      function applyRoleHint() {
        const params = new URLSearchParams(window.location.search);
        const role = params.get("role");
        if (!role) {
          const storedCodigo = getStoredMaquininhaCodigo();
          if (storedCodigo) {
            setAuthPanel("maquininha");
            if (elements.maquininhaCodigo) {
              elements.maquininhaCodigo.value = storedCodigo;
              updateMaquininhaPreview(storedCodigo);
            }
          }
          return;
        }
        const panel = AUTH_PANEL_BY_ROLE[role] || "corporativo";
        setAuthPanel(panel);
        if (role === "funcionario" || role === "colaborador") {
          setColabMessage("Area do colaborador", "ok");
          elements.colabCpf.focus();
          return;
        }
        if (role === "maquininha") {
          setMessage(elements.maquininhaMessage, "Acesso maquininha", "ok");
          if (elements.maquininhaCodigo) {
            elements.maquininhaCodigo.focus();
            updateMaquininhaPreview(elements.maquininhaCodigo.value);
          } else if (elements.maquininhaPin) {
            elements.maquininhaPin.focus();
          }
          return;
        }
        const hints = {
          admin: "Acesso administrador",
          empresa: "Acesso empresa",
          posto: "Acesso posto",
        };
        if (hints[role]) {
          setAuthMessage(hints[role], "ok");
          elements.loginEmail.focus();
        }
      }

      function renderAdminSummary() {
        const transacoes = Array.isArray(state.transacoes) ? state.transacoes : [];
        const pendentes = transacoes.filter((tx) => isTxPending(tx));
        const confirmadas = transacoes.filter((tx) => isTxConfirmed(tx));
        const total = confirmadas.reduce((sum, tx) => sum + Number(tx.valor || 0), 0);
        const ticket = confirmadas.length ? total / confirmadas.length : 0;
        const limiteTotalCarteira = state.funcionarios.reduce((sum, func) => sum + limiteFuncionario(func.id), 0);
        const empresasAtivas = new Set(confirmadas.map((tx) => tx.empresaId).filter(Boolean)).size;
        elements.adminKpiEmpresas.textContent = state.empresas.length;
        if (elements.adminKpiAtivasEmpresas) {
          elements.adminKpiAtivasEmpresas.textContent = empresasAtivas;
        }
        elements.adminKpiFuncionarios.textContent = state.funcionarios.length;
        elements.adminKpiPostos.textContent = state.postos.length;
        elements.adminKpiTransacoes.textContent = confirmadas.length;
        if (elements.adminKpiPendentes) {
          elements.adminKpiPendentes.textContent = pendentes.length;
        }
        elements.adminKpiTotal.textContent = formatBRL(total);
        if (elements.adminKpiTicket) {
          elements.adminKpiTicket.textContent = formatBRL(ticket);
        }
        if (elements.adminKpiLimiteTotal) {
          elements.adminKpiLimiteTotal.textContent = formatBRL(limiteTotalCarteira);
        }
        elements.adminTransacoesResumo.innerHTML = "";
        const resumo = transacoes.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
        if (!resumo.length) {
          const row = document.createElement("tr");
          row.innerHTML = `<td colspan="4" class="muted">Sem transacoes recentes.</td>`;
          elements.adminTransacoesResumo.appendChild(row);
        } else {
          resumo.forEach((tx) => {
            const funcionario = getFuncionario(tx.funcionarioId);
            const posto = getPosto(tx.postoId);
            const txId = escapeHtml(tx.id || "--");
            const funcionarioNome = escapeHtml(funcionario?.nome || "--");
            const postoNome = escapeHtml(posto?.nome || "--");
            const row = document.createElement("tr");
            row.innerHTML = `<td>${txId}</td><td>${funcionarioNome}</td><td>${postoNome}</td><td>${formatBRL(tx.valor)}</td>`;
            elements.adminTransacoesResumo.appendChild(row);
          });
        }

        if (elements.adminRiskList) {
          elements.adminRiskList.innerHTML = "";
          const consumoPorFuncionario = new Map();
          confirmadas.forEach((tx) => {
            const current = consumoPorFuncionario.get(tx.funcionarioId) || 0;
            consumoPorFuncionario.set(tx.funcionarioId, current + Number(tx.valor || 0));
          });
          const alertaSaldo = state.funcionarios
            .map((func) => {
              const limite = limiteFuncionario(func.id);
              const consumo = consumoPorFuncionario.get(func.id) || 0;
              const saldo = Math.max(0, limite - consumo);
              const pct = limite > 0 ? (consumo / limite) * 100 : 0;
              return { func, limite, consumo, saldo, pct };
            })
            .filter((item) => item.pct >= 85)
            .sort((a, b) => b.pct - a.pct)
            .slice(0, 4);
          if (!alertaSaldo.length && !pendentes.length) {
            elements.adminRiskList.innerHTML = '<div class="admin-insight-item muted">Sem alertas criticos no momento.</div>';
          } else {
            alertaSaldo.forEach((item) => {
              const div = document.createElement("div");
              div.className = "admin-insight-item";
              div.innerHTML = `
                <strong>${escapeHtml(item.func.nome || "--")}</strong>
                <div class="muted">Uso de limite: ${Math.round(item.pct)}% | Saldo: ${formatBRL(item.saldo)}</div>
              `;
              elements.adminRiskList.appendChild(div);
            });
            if (pendentes.length) {
              const pendenteCard = document.createElement("div");
              pendenteCard.className = "admin-insight-item";
              pendenteCard.innerHTML = `<strong>Pendencias de confirmacao</strong><div class="muted">${pendentes.length} transacao(oes) aguardando aprovacao.</div>`;
              elements.adminRiskList.appendChild(pendenteCard);
            }
          }
        }

        if (elements.adminTopEmpresas) {
          elements.adminTopEmpresas.innerHTML = "";
          const totais = new Map();
          confirmadas.forEach((tx) => {
            const current = totais.get(tx.empresaId) || { total: 0, count: 0 };
            current.total += Number(tx.valor || 0);
            current.count += 1;
            totais.set(tx.empresaId, current);
          });
          const ranking = Array.from(totais.entries())
            .map(([empresaId, data]) => ({
              empresa: getEmpresa(empresaId),
              total: data.total,
              count: data.count,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
          if (!ranking.length) {
            elements.adminTopEmpresas.innerHTML = '<div class="admin-insight-item muted">Sem consumo confirmado no periodo.</div>';
          } else {
            ranking.forEach((entry, index) => {
              const div = document.createElement("div");
              div.className = "admin-insight-item";
              div.innerHTML = `
                <strong>${index + 1}. ${escapeHtml(entry.empresa?.nome || "--")}</strong>
                <div class="muted">${entry.count} transacao(oes) | ${formatBRL(entry.total)}</div>
              `;
              elements.adminTopEmpresas.appendChild(div);
            });
          }
        }
      }

      function renderAdminCadastros() {
        if (elements.adminDbStatus) {
          if (DEMO_MODE || window.location.protocol === "file:") {
            elements.adminDbStatus.className = "admin-db-status warn";
            elements.adminDbStatus.textContent = "Pre-visualizacao local: os cadastros reais aparecem quando os arquivos estao na Hostinger conectados ao banco.";
          } else if (serverStateHealthy) {
            elements.adminDbStatus.className = "admin-db-status ok";
            elements.adminDbStatus.textContent = `Banco conectado | ${state.empresas.length} empresa(s) e ${state.funcionarios.length} funcionario(s) carregados.`;
          } else {
            elements.adminDbStatus.className = "admin-db-status warn";
            elements.adminDbStatus.textContent = `Banco temporariamente indisponivel${serverStateLastError ? ` (${serverStateLastError})` : ""}. Os cadastros do servidor nao serao sobrescritos por uma tela vazia.`;
          }
        }
        if (elements.empresaAdminCount) {
          elements.empresaAdminCount.textContent = `${state.empresas.length} cadastrada(s)`;
        }
        if (elements.funcAdminCount) {
          elements.funcAdminCount.textContent = `${state.funcionarios.length} cadastrado(s)`;
        }
        elements.empresaAdminList.innerHTML = "";
        if (!state.empresas.length) {
          setMessage(elements.empresaAdminListMsg, "Nenhuma empresa cadastrada.", "muted");
          elements.empresaAdminList.innerHTML = '<div class="admin-empty-state">Cadastre a primeira empresa para liberar usuarios corporativos e colaboradores.</div>';
        } else {
          setMessage(elements.empresaAdminListMsg, "", "muted");
          state.empresas.forEach((empresa) => {
            const item = document.createElement("div");
            item.className = "admin-item";
            const empresaNome = escapeHtml(empresa.nome || "--");
            const empresaCnpj = escapeHtml(empresa.cnpj || "--");
            const empresaFechamento = escapeHtml(empresa.fechamento || "--");
            const empresaId = escapeHtml(empresa.id || "");
            const empresaLimiteDescricao = descricaoLimiteEmpresa(empresa);
            item.innerHTML = `
              <div class="admin-item-main">
                <div class="admin-item-title"><span>${empresaNome}</span></div>
                <div class="admin-item-meta">CNPJ: ${empresaCnpj} | Fechamento: ${empresaFechamento} | Limite: ${escapeHtml(empresaLimiteDescricao)}</div>
              </div>
              <div class="admin-item-actions">
                <button class="btn ghost" data-action="edit-empresa" data-id="${empresaId}">Editar</button>
                <button class="btn" data-action="delete-empresa" data-id="${empresaId}">Excluir</button>
              </div>
            `;
            elements.empresaAdminList.appendChild(item);
          });
        }

        const selectedEmpresaFilter = elements.funcAdminEmpresaFilter?.value || "";
        if (elements.funcAdminEmpresaFilter) {
          const empresaOptions = state.empresas
            .slice()
            .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
            .map((empresa) => `<option value="${escapeHtml(empresa.id)}">${escapeHtml(empresa.nome || empresa.id)}</option>`)
            .join("");
          elements.funcAdminEmpresaFilter.innerHTML = `<option value="">Todas as empresas</option>${empresaOptions}`;
          if (state.empresas.some((empresa) => empresa.id === selectedEmpresaFilter)) {
            elements.funcAdminEmpresaFilter.value = selectedEmpresaFilter;
          }
        }

        const funcSearch = String(elements.funcAdminSearch?.value || "").trim().toLowerCase();
        const funcSearchDigits = normalizeCpf(funcSearch);
        const empresaFilter = elements.funcAdminEmpresaFilter?.value || "";
        const statusFilter = elements.funcAdminStatusFilter?.value || "";
        const filteredFuncionarios = state.funcionarios
          .filter((funcionario) => {
            if (empresaFilter && funcionario.empresaId !== empresaFilter) return false;
            const ativo = isFuncionarioAtivo(funcionario);
            if (statusFilter === "ativo" && !ativo) return false;
            if (statusFilter === "inativo" && ativo) return false;
            if (!funcSearch) return true;
            const empresa = getEmpresa(funcionario.empresaId);
            const haystack = [
              funcionario.nome,
              funcionario.cpf,
              funcionario.matricula,
              funcionario.contrato,
              funcionario.localidade,
              funcionario.email,
              empresa?.nome,
            ]
              .map((value) => String(value || "").toLowerCase())
              .join(" ");
            if (haystack.includes(funcSearch)) return true;
            if (funcSearchDigits) {
              return normalizeCpf(funcionario.cpf).includes(funcSearchDigits) ||
                normalizeMatricula(funcionario.matricula).includes(funcSearchDigits);
            }
            return false;
          })
          .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

        if (elements.funcAdminSummary) {
          const ativos = state.funcionarios.filter((funcionario) => isFuncionarioAtivo(funcionario)).length;
          const inativos = Math.max(0, state.funcionarios.length - ativos);
          elements.funcAdminSummary.textContent = `Exibindo ${filteredFuncionarios.length} de ${state.funcionarios.length} funcionarios | Ativos: ${ativos} | Inativos: ${inativos}`;
        }
        setMessage(elements.funcAdminListMsg, "", "muted");
        elements.funcAdminTable.innerHTML = "";
        if (!state.funcionarios.length) {
          elements.funcAdminTable.innerHTML = '<div class="admin-empty-state">Nenhum funcionario cadastrado no banco carregado.</div>';
        } else if (!filteredFuncionarios.length) {
          elements.funcAdminTable.innerHTML = '<div class="admin-empty-state">Nenhum funcionario encontrado com os filtros selecionados.</div>';
        } else {
          filteredFuncionarios.forEach((funcionario) => {
            const empresa = getEmpresa(funcionario.empresaId);
            const auth = getColaboradorAuthByFuncionarioId(funcionario.id);
            const senhaAcesso = auth?.senha ? "Definida" : "Nao definida";
            const senhaTransacao = auth?.senhaTransacao ? "Definida" : "Nao definida";
            const salario = parseSalario(funcionario.salario);
            const funcionarioId = escapeHtml(funcionario.id || "");
            const funcionarioNome = escapeHtml(funcionario.nome || "--");
            const empresaNome = escapeHtml(empresa?.nome || "--");
            const cpf = escapeHtml(funcionario.cpf || "--");
            const matricula = escapeHtml(funcionario.matricula || "--");
            const email = escapeHtml(funcionario.email || "--");
            const telefone = escapeHtml(funcionario.telefone || "--");
            const localidade = escapeHtml(funcionario.localidade || "--");
            const ativo = isFuncionarioAtivo(funcionario);
            const card = document.createElement("article");
            card.className = "admin-employee-card";
            card.innerHTML = `
              <div class="admin-employee-card-head">
                <div class="admin-employee-card-title">
                  <strong>${funcionarioNome}</strong>
                  <span class="muted">${empresaNome} | ID: ${funcionarioId || "--"}</span>
                </div>
                <div class="admin-employee-card-actions">
                  <span class="admin-employee-status ${ativo ? "active" : "inactive"}">${ativo ? "Ativo" : "Inativo"}</span>
                  <button class="btn" data-action="delete-funcionario-admin" data-id="${funcionarioId}" type="button">Excluir funcionario</button>
                </div>
              </div>
              <div class="admin-employee-card-grid">
                <div class="admin-employee-detail"><span>CPF</span><strong>${cpf}</strong></div>
                <div class="admin-employee-detail"><span>Matricula</span><strong>${matricula}</strong></div>
                <div class="admin-employee-detail"><span>Contrato</span><strong>${escapeHtml(funcionario.contrato || "--")}</strong></div>
                <div class="admin-employee-detail"><span>Cidade</span><strong>${localidade}</strong></div>
                <div class="admin-employee-detail"><span>Limite mensal</span><strong>${formatBRL(limiteFuncionario(funcionario.id))}</strong></div>
                <div class="admin-employee-detail"><span>Email</span><strong>${email}</strong></div>
                <div class="admin-employee-detail"><span>Telefone</span><strong>${telefone}</strong></div>
                <div class="admin-employee-detail"><span>Salario</span><strong>${salario > 0 ? formatBRL(salario) : "--"}</strong></div>
                <div class="admin-employee-detail"><span>Acesso</span><strong>Login: ${senhaAcesso} | Transacao: ${auth?.senhaTransacao ? "cadastrada" : "nao cadastrada"}</strong></div>
              </div>`;
            elements.funcAdminTable.appendChild(card);
          });
        }

        elements.postoAdminList.innerHTML = "";
        if (!state.postos.length) {
          setMessage(elements.postoAdminListMsg, "Nenhuma maquininha cadastrada.", "muted");
          elements.postoAdminList.innerHTML = '<div class="admin-empty-state">Cadastre uma maquininha para habilitar validacao no posto.</div>';
        } else {
          setMessage(elements.postoAdminListMsg, "", "muted");
          const postosPorCidade = new Map();
          state.postos.forEach((posto) => {
            const cidade = getPostoCidade(posto);
            if (!postosPorCidade.has(cidade)) postosPorCidade.set(cidade, []);
            postosPorCidade.get(cidade).push(posto);
          });
          Array.from(postosPorCidade.entries())
            .sort(([cidadeA], [cidadeB]) => cidadeA.localeCompare(cidadeB, "pt-BR"))
            .forEach(([cidade, postosCidade], groupIndex) => {
              const group = document.createElement("details");
              group.className = "posto-city-group";
              group.open = groupIndex === 0;
              const summary = document.createElement("summary");
              summary.innerHTML = `<span>${escapeHtml(cidade)}</span><span class="posto-city-group-count">${postosCidade.length}</span>`;
              const body = document.createElement("div");
              body.className = "posto-city-group-body";
              postosCidade
                .slice()
                .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
                .forEach((posto) => {
                  const item = document.createElement("div");
                  item.className = "admin-item";
                  const postoNome = escapeHtml(posto.nome || "--");
                  const postoId = escapeHtml(posto.id || "");
                  const local = escapeHtml(formatPostoLocalizacao(posto));
                  const codigo = escapeHtml(posto.codigoMaquininha ? posto.codigoMaquininha : "--");
                  const acesso = escapeHtml(maskAccessCode(posto.codigoAcesso));
                  const cnpj = escapeHtml(posto.cnpj || "--");
                  item.innerHTML = `
                    <div class="admin-item-main">
                      <div class="admin-item-title"><span>${postoNome}</span></div>
                      <div class="admin-item-meta">Cidade: ${escapeHtml(cidade)} | Código: ${codigo} | Acesso: ${acesso} | CNPJ: ${cnpj} | Localização: ${local} | ID: ${postoId}</div>
                    </div>
                    <div class="admin-item-actions">
                      <button class="btn ghost" data-action="edit-posto" data-id="${postoId}">Editar</button>
                      <button class="btn" data-action="delete-posto" data-id="${postoId}">Excluir</button>
                    </div>
                  `;
                  body.appendChild(item);
                });
              group.append(summary, body);
              elements.postoAdminList.appendChild(group);
            });
        }
      }

      function openEmpresaModal(empresa) {
        if (!empresa) return;
        editingEmpresaId = empresa.id;
        elements.empresaModal.classList.remove("hidden");
        elements.empresaModal.setAttribute("aria-hidden", "false");
        elements.empresaModalMsg.textContent = "";
        elements.empresaModalMsg.className = "message muted";
        setMessage(elements.empresaLogoMsg, "", "muted");
        elements.empresaModalNome.value = empresa.nome || "";
        elements.empresaModalCnpj.value = empresa.cnpj || "";
        elements.empresaModalFechamento.value = empresa.fechamento || "";
        const limiteConfig = getEmpresaLimiteConfig(empresa);
        elements.empresaModalLimiteTipo.value = limiteConfig.tipo;
        elements.empresaModalLimiteFixo.value = limiteConfig.valorFixo > 0 ? formatSalarioInput(limiteConfig.valorFixo) : "";
        elements.empresaModalLimiteFixoWrap.classList.toggle("hidden", limiteConfig.tipo !== "fixo");
        const empresaUser = getEmpresaUser(empresa.id);
        elements.empresaModalEmail.value = empresaUser?.email || "";
        elements.empresaModalSenha.value = "";
        renderEmpresaLogo(empresa);
        elements.empresaLogoInput.value = "";
      }

      function closeEmpresaModal() {
        editingEmpresaId = null;
        elements.empresaModal.classList.add("hidden");
        elements.empresaModal.setAttribute("aria-hidden", "true");
        elements.empresaLogoInput.value = "";
        elements.empresaModalEmail.value = "";
        elements.empresaModalSenha.value = "";
        setMessage(elements.empresaLogoMsg, "", "muted");
      }

      function handleEmpresaModalSave() {
        const empresa = getEmpresa(editingEmpresaId);
        if (!empresa) {
          setMessage(elements.empresaModalMsg, "Empresa invalida.", "bad");
          return;
        }
        const nome = elements.empresaModalNome.value.trim();
        if (!nome) {
          setMessage(elements.empresaModalMsg, "Informe o nome da empresa.", "bad");
          return;
        }
        empresa.nome = nome;
        empresa.cnpj = elements.empresaModalCnpj.value.trim() || undefined;
        const fechamentoRaw = elements.empresaModalFechamento.value.trim();
        empresa.fechamento = normalizeFechamento(fechamentoRaw || empresa.fechamento || "Dia 30");
        const limiteTipo = elements.empresaModalLimiteTipo.value === "fixo" ? "fixo" : "percentual";
        let limiteValorFixo = getEmpresaLimiteConfig(empresa).valorFixo;
        if (limiteTipo === "fixo") {
          limiteValorFixo = parseCurrencyInput(elements.empresaModalLimiteFixo.value);
          if (!Number.isFinite(limiteValorFixo) || limiteValorFixo <= 0) {
            setMessage(elements.empresaModalMsg, "Informe um valor fixo maior que zero.", "bad");
            return;
          }
        }
        empresa.limiteTipo = limiteTipo;
        empresa.limitePercentual = 30;
        empresa.limiteTeto = LIMITE_MAXIMO_CREDITO;
        empresa.limiteValorFixo = Math.round(limiteValorFixo * 100) / 100;
        empresa.limiteMensal = empresa.limiteValorFixo;
        const loginEmail = elements.empresaModalEmail.value.trim();
        const loginSenha = elements.empresaModalSenha.value.trim();
        if (loginSenha) {
          const senhaRuleError = accessPasswordRuleError(loginSenha);
          if (senhaRuleError) {
            setMessage(elements.empresaModalMsg, senhaRuleError, "bad");
            return;
          }
        }
        const empresaUser = getEmpresaUser(empresa.id);
        if (loginEmail) {
          const existingUser = getUsuarioByEmailInsensitive(loginEmail);
          if (existingUser && existingUser.id !== empresaUser?.id) {
            setMessage(elements.empresaModalMsg, "Email ja utilizado em outro acesso.", "bad");
            return;
          }
          if (!empresaUser && !loginSenha) {
            setMessage(elements.empresaModalMsg, "Informe uma senha para criar o acesso.", "bad");
            return;
          }
          if (empresaUser) {
            empresaUser.email = loginEmail;
            empresaUser.nome = empresa.nome;
            if (loginSenha) {
              empresaUser.senha = loginSenha;
            }
          } else {
            state.usuarios.push({
              id: generateId("U"),
              nome: empresa.nome,
              email: loginEmail,
              senha: loginSenha,
              role: "empresa",
              empresaId: empresa.id,
            });
          }
        } else if (loginSenha) {
          setMessage(elements.empresaModalMsg, "Informe o email para atualizar a senha.", "bad");
          return;
        } else if (empresaUser) {
          empresaUser.nome = empresa.nome;
        }
        setMessage(elements.empresaModalMsg, "Empresa atualizada.", "ok");
        logEvent("EMPRESA_ATUALIZADA", empresa.nome);
        queueStateSave(true);
        closeEmpresaModal();
        syncSelects();
        renderAdmin();
        renderEmpresaDashboard();
        renderReports();
        updateHeaderBrand();
      }

      function handleEmpresaLogoRemove() {
        const empresa = getEmpresa(editingEmpresaId);
        if (!empresa) {
          setMessage(elements.empresaLogoMsg, "Empresa invalida.", "bad");
          return;
        }
        empresa.logoData = undefined;
        renderEmpresaLogo(empresa);
        setMessage(elements.empresaLogoMsg, "Logo removida.", "ok");
        queueStateSave(true);
        elements.empresaLogoInput.value = "";
        renderReports();
        renderAdmin();
        updateHeaderBrand();
      }

      async function handleEmpresaAdminListAction(event) {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const empresaId = button.dataset.id;
        const action = button.dataset.action;
        const empresa = getEmpresa(empresaId);
        if (!empresa) {
          setMessage(elements.empresaAdminListMsg, "Empresa invalida.", "bad");
          return;
        }
        if (action === "edit-empresa") {
          openEmpresaModal(empresa);
          return;
        }
        if (action === "delete-empresa") {
          if (!window.confirm("Excluir empresa? Funcionarios e transacoes vinculadas serao removidos.")) {
            return;
          }
          const remoteDelete = await deleteEmpresaOnServer(empresaId);
          if (remoteDelete.ok && remoteDelete.data) {
            applyStateSnapshot(remoteDelete.data);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteDelete.data));
            } catch (error) {
            }
            logEvent("EMPRESA_EXCLUIDA", empresa.nome);
            setMessage(elements.empresaAdminListMsg, "Empresa excluida.", "ok");
            syncSelects();
            renderAdmin();
            renderReports();
            renderEmpresaDashboard();
            renderPostosList();
            return;
          }
          const funcionariosEmpresa = state.funcionarios.filter((f) => f.empresaId === empresaId);
          const funcionarioIds = new Set(funcionariosEmpresa.map((f) => f.id));
          const funcionarioCpfs = new Set(
            funcionariosEmpresa.map((f) => normalizeCpf(f.cpf)).filter((cpf) => cpf)
          );
          state.empresas = state.empresas.filter((e) => e.id !== empresaId);
          state.usuarios = state.usuarios.filter((u) => {
            if (u.role === "empresa" && u.empresaId === empresaId) return false;
            if (u.role === "funcionario") {
              if (funcionarioIds.has(u.funcionarioId)) return false;
              const cpf = normalizeCpf(u.cpf);
              if (cpf && funcionarioCpfs.has(cpf)) return false;
            }
            return true;
          });
          state.funcionarios = state.funcionarios.filter((f) => f.empresaId !== empresaId);
          state.colaboradoresAuth = state.colaboradoresAuth.filter((auth) => {
            if (funcionarioIds.has(auth.funcionarioId)) return false;
            const cpf = normalizeCpf(auth.cpf);
            return cpf ? !funcionarioCpfs.has(cpf) : true;
          });
          state.transacoes = state.transacoes.filter((tx) => tx.empresaId !== empresaId);
          logEvent("EMPRESA_EXCLUIDA", empresa.nome);
          const saved = await queueStateSave(true);
          if (!saved) {
            setMessage(
              elements.empresaAdminListMsg,
              "Falha ao excluir no banco. Verifique a conexao/API e tente novamente.",
              "bad"
            );
            await loadStateFromServer();
            syncSelects();
            renderAdmin();
            renderReports();
            renderEmpresaDashboard();
            renderPostosList();
            return;
          }
          setMessage(elements.empresaAdminListMsg, "Empresa excluida.", "ok");
          syncSelects();
          renderAdmin();
          renderReports();
          renderEmpresaDashboard();
          renderPostosList();
        }
      }

      async function handleFuncionarioAdminTableAction(event) {
        const button = event.target.closest("button[data-action]");
        if (!button || button.dataset.action !== "delete-funcionario-admin") return;
        const funcionarioId = button.dataset.id || "";
        const funcionario = getFuncionario(funcionarioId);
        if (!funcionario) {
          setMessage(elements.funcAdminListMsg, "Funcionario invalido ou ja excluido.", "bad");
          return;
        }
        if (!window.confirm(`Excluir ${funcionario.nome || "este funcionario"}? O acesso sera removido e o historico financeiro sera preservado.`)) {
          return;
        }

        button.disabled = true;
        const remoteDelete = await deleteFuncionarioOnServer(funcionarioId);
        if (remoteDelete.ok && remoteDelete.data) {
          applyStateSnapshot(remoteDelete.data);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteDelete.data));
          } catch (error) {
          }
          logEvent("FUNCIONARIO_EXCLUIDO_ADMIN", funcionario.nome || funcionarioId);
          refreshFuncionarioViews();
          setMessage(elements.funcAdminListMsg, "Funcionario excluido com sucesso.", "ok");
          return;
        }

        if (remoteDelete.skipped) {
          const cpf = normalizeCpf(funcionario.cpf);
          state.funcionarios = state.funcionarios.filter((item) => item.id !== funcionarioId);
          state.usuarios = state.usuarios.filter((usuario) => {
            if (usuario.funcionarioId === funcionarioId) return false;
            return cpf ? normalizeCpf(usuario.cpf) !== cpf : true;
          });
          state.colaboradoresAuth = state.colaboradoresAuth.filter((auth) => {
            if (auth.funcionarioId === funcionarioId) return false;
            return cpf ? normalizeCpf(auth.cpf) !== cpf : true;
          });
          state.transacoes = state.transacoes.filter((tx) => tx.funcionarioId !== funcionarioId);
          logEvent("FUNCIONARIO_EXCLUIDO_ADMIN", funcionario.nome || funcionarioId);
          await queueStateSave(true);
          refreshFuncionarioViews();
          setMessage(elements.funcAdminListMsg, "Funcionario excluido.", "ok");
          return;
        }

        button.disabled = false;
        const errors = {
          funcionario_not_found: "Funcionario nao encontrado no banco.",
          invalid_funcionario_id: "Identificador do funcionario invalido.",
          db_write_failed: "Falha ao excluir o funcionario no banco de dados.",
          network_error: "Falha de conexao ao excluir. Verifique a internet e tente novamente.",
        };
        setMessage(
          elements.funcAdminListMsg,
          errors[remoteDelete.error] || `Nao foi possivel excluir o funcionario (${remoteDelete.error || "erro_desconhecido"}).`,
          "bad"
        );
      }

      function renderPostoLogo(posto) {
        if (!elements.postoModalLogoPreview || !elements.postoModalLogoPlaceholder) return;
        if (posto?.logoData) {
          elements.postoModalLogoPreview.src = posto.logoData;
          elements.postoModalLogoPreview.classList.remove("hidden");
          elements.postoModalLogoPlaceholder.classList.add("hidden");
        } else {
          elements.postoModalLogoPreview.removeAttribute("src");
          elements.postoModalLogoPreview.classList.add("hidden");
          elements.postoModalLogoPlaceholder.classList.remove("hidden");
        }
      }

      function openPostoModal(posto) {
        if (!posto) return;
        editingPostoId = posto.id;
        elements.postoModal.classList.remove("hidden");
        elements.postoModal.setAttribute("aria-hidden", "false");
        elements.postoModalMsg.textContent = "";
        elements.postoModalMsg.className = "message muted";
        elements.postoModalCodigo.value = posto.codigoMaquininha || "";
        elements.postoModalAcesso.value = posto.codigoAcesso || "";
        elements.postoModalNome.value = posto.nome || "";
        elements.postoModalCnpj.value = posto.cnpj || "";
        if (elements.postoModalCidade) elements.postoModalCidade.value = posto.cidade || "";
        elements.postoModalLocalizacao.value = posto.localizacao || "";
        const postoUser = getPostoUserById(posto.id);
        if (elements.postoModalEmail) {
          elements.postoModalEmail.value = postoUser?.email || "";
        }
        if (elements.postoModalSenha) {
          elements.postoModalSenha.value = "";
        }
        renderPostoLogo(posto);
        elements.postoModalLogoInput.value = "";
      }

      function closePostoModal() {
        editingPostoId = null;
        elements.postoModal.classList.add("hidden");
        elements.postoModal.setAttribute("aria-hidden", "true");
        elements.postoModalLogoInput.value = "";
        elements.postoModalAcesso.value = "";
        if (elements.postoModalCidade) elements.postoModalCidade.value = "";
        if (elements.postoModalEmail) {
          elements.postoModalEmail.value = "";
        }
        if (elements.postoModalSenha) {
          elements.postoModalSenha.value = "";
        }
        setMessage(elements.postoModalMsg, "", "muted");
      }

      async function handlePostoModalSave() {
        const posto = getPosto(editingPostoId);
        if (!posto) {
          setMessage(elements.postoModalMsg, "Maquininha invalida.", "bad");
          return;
        }
        const codigoDigitado = elements.postoModalCodigo.value.trim();
        const codigo = codigoDigitado || posto.codigoMaquininha || generateUniqueCodigoMaquininha();
        const acesso = elements.postoModalAcesso.value.trim();
        if (!acesso || acesso.length < 4) {
          setMessage(elements.postoModalMsg, "Informe o codigo de acesso da maquininha.", "bad");
          return;
        }
        if (isCodigoMaquininhaDuplicado(codigo, posto.id)) {
          setMessage(elements.postoModalMsg, "Codigo de maquininha ja cadastrado.", "bad");
          return;
        }
        const nome = elements.postoModalNome.value.trim();
        if (!nome) {
          setMessage(elements.postoModalMsg, "Informe o nome do posto.", "bad");
          return;
        }
        const localizacao = elements.postoModalLocalizacao.value.trim();
        const coords = getCoordinatesFromLocalizacao(localizacao);
        posto.codigoMaquininha = codigo;
        posto.codigoAcesso = acesso;
        posto.nome = nome;
        posto.cnpj = elements.postoModalCnpj.value.trim() || undefined;
        posto.cidade = elements.postoModalCidade?.value.trim() || undefined;
        posto.localizacao = localizacao || undefined;
        posto.lat = coords?.lat;
        posto.lng = coords?.lng;
        const loginEmail = elements.postoModalEmail ? elements.postoModalEmail.value.trim() : "";
        const loginSenha = elements.postoModalSenha ? elements.postoModalSenha.value.trim() : "";
        const existingUser = getPostoUserById(posto.id);
        if (loginEmail) {
          const duplicate = getUsuarioByEmailInsensitive(loginEmail);
          if (duplicate && duplicate.id !== existingUser?.id) {
            setMessage(elements.postoModalMsg, "Email ja esta em uso.", "bad");
            return;
          }
        }
        if (loginSenha) {
          const senhaRuleError = accessPasswordRuleError(loginSenha);
          if (senhaRuleError) {
            setMessage(elements.postoModalMsg, senhaRuleError, "bad");
            return;
          }
        }
        if (existingUser) {
          existingUser.nome = posto.nome;
          if (loginEmail) {
            existingUser.email = loginEmail;
          }
          if (loginSenha) {
            existingUser.senha = loginSenha;
          }
        } else if (loginEmail || loginSenha) {
          if (!loginEmail || !loginSenha) {
            setMessage(elements.postoModalMsg, "Informe email e senha para o acesso do posto.", "bad");
            return;
          }
          state.usuarios.push({
            id: generateId("U"),
            nome: posto.nome,
            email: loginEmail,
            senha: loginSenha,
            role: "posto",
            postoId: posto.id,
          });
        }
        logEvent("POSTO_ATUALIZADO", posto.nome);
        const saved = await queueStateSave(true);
        if (!saved) {
          setMessage(
            elements.postoModalMsg,
            `Maquininha atualizada localmente, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
            "warn"
          );
          return;
        }
        setMessage(elements.postoModalMsg, "Maquininha atualizada.", "ok");
        closePostoModal();
        syncSelects();
        renderAdmin();
        renderReports();
        renderPostosList();
      }

      async function normalizeBrandLogoFile(file) {
        if (!file || !String(file.type || "").startsWith("image/")) return "";
        const original = await readFileAsDataUrl(file);
        if (!original) return "";
        const image = await loadImageFromDataUrl(original);
        const width = image.naturalWidth || image.width || 1;
        const height = image.naturalHeight || image.height || 1;
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(width, height, 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        if (!context) return "";
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let candidate = "";
        try {
          candidate = canvas.toDataURL("image/png");
        } catch (error) {
          candidate = "";
        }
        if (candidate && candidate.length <= 190000) return candidate;
        const jpgCanvas = document.createElement("canvas");
        jpgCanvas.width = canvas.width;
        jpgCanvas.height = canvas.height;
        const jpgContext = jpgCanvas.getContext("2d");
        if (!jpgContext) return "";
        jpgContext.fillStyle = "#ffffff";
        jpgContext.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
        jpgContext.drawImage(canvas, 0, 0);
        for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
          try {
            candidate = jpgCanvas.toDataURL("image/jpeg", quality);
          } catch (error) {
            candidate = "";
          }
          if (candidate && candidate.length <= 190000) return candidate;
        }
        return candidate && candidate.length <= MAX_MEDIA_DATA_URI_CHARS ? candidate : "";
      }

      async function handlePostoLogoUpload(event) {
        const posto = getPosto(editingPostoId);
        if (!posto) {
          setMessage(elements.postoModalMsg, "Maquininha invalida.", "bad");
          elements.postoModalLogoInput.value = "";
          return;
        }
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
          setMessage(elements.postoModalMsg, "Selecione uma imagem valida.", "bad");
          elements.postoModalLogoInput.value = "";
          return;
        }
        try {
          const normalized = await normalizeBrandLogoFile(file);
          if (!normalized) throw new Error("logo_normalize_failed");
          posto.logoData = normalized;
          const saved = await queueStateSave(true);
          setMessage(elements.postoModalMsg, saved ? "Logo atualizada e salva." : "Logo atualizada, mas houve falha ao salvar no banco.", saved ? "ok" : "warn");
          renderPostoLogo(posto);
          renderAdmin();
          renderReports();
        } catch (error) {
          setMessage(elements.postoModalMsg, "Falha ao preparar a logo. Tente uma imagem PNG ou JPG.", "bad");
        }
        elements.postoModalLogoInput.value = "";
      }

      function handlePostoLogoRemove() {
        const posto = getPosto(editingPostoId);
        if (!posto) {
          setMessage(elements.postoModalMsg, "Maquininha invalida.", "bad");
          return;
        }
        posto.logoData = undefined;
        renderPostoLogo(posto);
        setMessage(elements.postoModalMsg, "Logo removida.", "ok");
        queueStateSave(true);
        elements.postoModalLogoInput.value = "";
        renderAdmin();
        renderReports();
      }

      async function handlePostoAdminListAction(event) {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const postoId = button.dataset.id;
        const action = button.dataset.action;
        const posto = getPosto(postoId);
        if (!posto) {
          setMessage(elements.postoAdminListMsg, "Maquininha invalida.", "bad");
          return;
        }
        if (action === "edit-posto") {
          openPostoModal(posto);
          return;
        }
        if (action === "delete-posto") {
          if (!window.confirm("Excluir maquininha? Esta acao nao pode ser desfeita.")) {
            return;
          }
          state.postos = state.postos.filter((p) => p.id !== postoId);
          state.empresas.forEach((empresa) => {
            if (Array.isArray(empresa.postosConvenio)) {
              empresa.postosConvenio = empresa.postosConvenio.filter((id) => id !== postoId);
            }
          });
          state.usuarios = state.usuarios.filter((u) => !(u.role === "posto" && u.postoId === postoId));
          logEvent("POSTO_EXCLUIDO", posto.nome);
          const saved = await queueStateSave(true);
          setMessage(
            elements.postoAdminListMsg,
            saved
              ? "Maquininha excluida."
              : `Maquininha excluida localmente, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
            saved ? "ok" : "warn"
          );
          syncSelects();
          renderAdmin();
          renderReports();
          renderPostosList();
        }
      }

      function openFuncionarioModal(funcionario) {
        if (!funcionario) return;
        editingFuncionarioId = funcionario.id;
        elements.funcModal.classList.remove("hidden");
        elements.funcModal.setAttribute("aria-hidden", "false");
        elements.funcModalMsg.textContent = "";
        elements.funcModalMsg.className = "message muted";
        elements.funcModalNome.value = funcionario.nome || "";
        elements.funcModalCpf.value = funcionario.cpf || "";
        elements.funcModalMatricula.value = funcionario.matricula || "";
        if (elements.funcModalContrato) elements.funcModalContrato.value = funcionario.contrato || "";
        elements.funcModalLocalidade.value = funcionario.localidade || "";
        elements.funcModalEmail.value = funcionario.email || "";
        elements.funcModalTelefone.value = funcionario.telefone || "";
        elements.funcModalSalario.value = formatSalarioInput(funcionario.salario);
      }

      function closeFuncionarioModal() {
        editingFuncionarioId = null;
        elements.funcModal.classList.add("hidden");
        elements.funcModal.setAttribute("aria-hidden", "true");
      }

      function syncEmpresaTeamFilterOptions(funcionarios) {
        const syncOptions = (select, values, emptyLabel) => {
          if (!select) return;
          const current = select.value;
          select.innerHTML = `<option value="">${emptyLabel}</option>`;
          values.forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
          });
          if (current && values.includes(current)) select.value = current;
        };
        const contratos = Array.from(new Set(funcionarios.map((f) => String(f.contrato || "").trim()).filter(Boolean)))
          .sort((a, b) => a.localeCompare(b, "pt-BR"));
        const localidades = Array.from(new Set(funcionarios.map((f) => String(f.localidade || "").trim()).filter(Boolean)))
          .sort((a, b) => a.localeCompare(b, "pt-BR"));
        syncOptions(elements.empresaFuncContratoFilter, contratos, "Todos os contratos");
        syncOptions(elements.empresaFuncLocalidadeFilter, localidades, "Todas as cidades");
      }

      function renderEmpresaOrgSummary(funcionarios, statsByFuncionario) {
        if (!elements.empresaOrgTableBody) return;
        const groups = new Map();
        funcionarios.forEach((func) => {
          const contratoRaw = String(func.contrato || "").trim();
          const localidadeRaw = String(func.localidade || "").trim();
          const key = `${contratoRaw}|||${localidadeRaw}`;
          const entry = groups.get(key) || {
            contratoRaw,
            localidadeRaw,
            contrato: contratoRaw || "Sem contrato",
            localidade: localidadeRaw || "Sem localidade",
            colaboradores: 0,
            ativos: 0,
            transacoes: 0,
            total: 0,
          };
          entry.colaboradores += 1;
          if (isFuncionarioAtivo(func)) entry.ativos += 1;
          const stats = statsByFuncionario.get(func.id) || { total: 0, count: 0 };
          entry.transacoes += stats.count;
          entry.total += stats.total;
          groups.set(key, entry);
        });
        const ordered = Array.from(groups.values()).sort((a, b) =>
          a.contrato.localeCompare(b.contrato, "pt-BR") || a.localidade.localeCompare(b.localidade, "pt-BR")
        );
        elements.empresaOrgTableBody.innerHTML = "";
        if (!ordered.length) {
          const row = document.createElement("tr");
          row.innerHTML = '<td colspan="6" class="muted">Nenhum grupo operacional cadastrado.</td>';
          elements.empresaOrgTableBody.appendChild(row);
        } else {
          ordered.forEach((group) => {
            const row = document.createElement("tr");
            row.dataset.contrato = group.contratoRaw;
            row.dataset.localidade = group.localidadeRaw;
            row.title = "Clique para filtrar esta equipe";
            row.innerHTML = `
              <td><strong>${escapeHtml(group.contrato)}</strong></td>
              <td>${escapeHtml(group.localidade)}</td>
              <td>${group.colaboradores}</td>
              <td>${group.ativos}</td>
              <td>${group.transacoes}</td>
              <td>${formatBRL(group.total)}</td>
            `;
            elements.empresaOrgTableBody.appendChild(row);
          });
        }
        if (elements.empresaOrgCount) {
          elements.empresaOrgCount.textContent = `${ordered.length} ${ordered.length === 1 ? "grupo" : "grupos"}`;
        }
      }

      function renderEmpresaFuncionariosList(transacoesConfirmadas = null) {
        if (currentUser?.role !== "empresa") return;
        const empresaId = currentUser.empresaId;
        const term = elements.empresaFuncSearch.value.trim().toLowerCase();
        const termDigits = normalizeMatricula(term);
        const sortBy = elements.empresaFuncSort?.value || "nome";
        const funcionarios = state.funcionarios.filter((f) => f.empresaId === empresaId);
        syncEmpresaTeamFilterOptions(funcionarios);
        const contratoFiltro = elements.empresaFuncContratoFilter?.value || "";
        const localidadeFiltro = elements.empresaFuncLocalidadeFilter?.value || "";
        const monthRange = elements.empresaMonthFilter
          ? getMonthRangeFromInput(elements.empresaMonthFilter.value)
          : null;
        const rangeStart = monthRange?.start || null;
        const rangeEnd = monthRange?.end || null;
        let scopeTx = state.transacoes.filter((tx) => {
          if (tx.empresaId !== empresaId) return false;
          if (rangeStart && tx.timestamp < rangeStart) return false;
          if (rangeEnd && tx.timestamp > rangeEnd) return false;
          return true;
        });
        scopeTx = filterTransacoesByConvenio(scopeTx, empresaId);
        const confirmedTx = Array.isArray(transacoesConfirmadas)
          ? transacoesConfirmadas
          : scopeTx.filter((tx) => isTxConfirmed(tx));
        const statsByFuncionario = new Map();
        confirmedTx.forEach((tx) => {
          const current = statsByFuncionario.get(tx.funcionarioId) || { total: 0, count: 0 };
          current.total += Number(tx.valor || 0);
          current.count += 1;
          statsByFuncionario.set(tx.funcionarioId, current);
        });
        renderEmpresaOrgSummary(funcionarios, statsByFuncionario);

        const filtered = funcionarios.filter((f) => {
          if (contratoFiltro && String(f.contrato || "").trim() !== contratoFiltro) return false;
          if (localidadeFiltro && String(f.localidade || "").trim() !== localidadeFiltro) return false;
          if (!term) return true;
          const matricula = normalizeMatricula(f.matricula);
          const matchesNumeric = termDigits
            ? matricula.includes(termDigits) || normalizeCpf(f.cpf).includes(termDigits)
            : false;
          return (
            String(f.nome || "").toLowerCase().includes(term) ||
            String(f.contrato || "").toLowerCase().includes(term) ||
            String(f.localidade || "").toLowerCase().includes(term) ||
            matchesNumeric
          );
        });

        filtered.sort((a, b) => {
          const aStats = statsByFuncionario.get(a.id) || { total: 0, count: 0 };
          const bStats = statsByFuncionario.get(b.id) || { total: 0, count: 0 };
          const aSaldo = Math.max(0, limiteFuncionario(a.id) - aStats.total);
          const bSaldo = Math.max(0, limiteFuncionario(b.id) - bStats.total);
          const aNome = String(a.nome || "");
          const bNome = String(b.nome || "");
          if (sortBy === "consumo_desc") return bStats.total - aStats.total || aNome.localeCompare(bNome, "pt-BR");
          if (sortBy === "saldo_asc") return aSaldo - bSaldo || aNome.localeCompare(bNome, "pt-BR");
          if (sortBy === "status") {
            const aStatus = isFuncionarioAtivo(a) ? 0 : 1;
            const bStatus = isFuncionarioAtivo(b) ? 0 : 1;
            return aStatus - bStatus || aNome.localeCompare(bNome, "pt-BR");
          }
          return aNome.localeCompare(bNome, "pt-BR");
        });

        const ativos = funcionarios.filter((f) => isFuncionarioAtivo(f)).length;
        const inativos = Math.max(0, funcionarios.length - ativos);
        const pageSize = Math.max(25, Number(elements.empresaFuncPageSize?.value || 50));
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        empresaFuncPage = Math.min(Math.max(1, empresaFuncPage), totalPages);
        const startIndex = (empresaFuncPage - 1) * pageSize;
        const pageRows = filtered.slice(startIndex, startIndex + pageSize);
        const endIndex = Math.min(filtered.length, startIndex + pageRows.length);
        if (elements.empresaFuncListSummary) {
          const scopeText = filtered.length
            ? `Mostrando ${startIndex + 1}-${endIndex} de ${filtered.length} filtrados`
            : "Nenhum colaborador no filtro";
          elements.empresaFuncListSummary.textContent = `${scopeText} | Total da empresa: ${funcionarios.length} | Ativos: ${ativos} | Inativos: ${inativos}`;
        }
        if (elements.empresaFuncPageLabel) elements.empresaFuncPageLabel.textContent = `Pagina ${empresaFuncPage} de ${totalPages}`;
        if (elements.empresaFuncPrev) elements.empresaFuncPrev.disabled = empresaFuncPage <= 1;
        if (elements.empresaFuncNext) elements.empresaFuncNext.disabled = empresaFuncPage >= totalPages;

        elements.empresaFuncList.innerHTML = "";
        if (!funcionarios.length) {
          setMessage(elements.empresaFuncListMsg, "Nenhum funcionario cadastrado.", "muted");
          return;
        }
        if (!filtered.length) {
          setMessage(elements.empresaFuncListMsg, "Nenhum funcionario encontrado para os filtros selecionados.", "warn");
          return;
        }
        setMessage(elements.empresaFuncListMsg, "", "muted");

        pageRows.forEach((funcionario) => {
          const statusOk = isFuncionarioAtivo(funcionario);
          const limite = limiteFuncionario(funcionario.id);
          const stats = statsByFuncionario.get(funcionario.id) || { total: 0, count: 0 };
          const consumoMes = stats.total;
          const abastecimentos = stats.count;
          const saldo = Math.max(0, limite - consumoMes);
          const utilizacao = limite > 0 ? Math.min(100, Math.round((consumoMes / limite) * 100)) : 0;
          const nomeSafe = escapeHtml(funcionario.nome || "--");
          const matriculaSafe = escapeHtml(funcionario.matricula || "--");
          const contratoSafe = escapeHtml(funcionario.contrato || "Sem contrato");
          const localidadeSafe = escapeHtml(funcionario.localidade || "Sem localidade");

          const card = document.createElement("article");
          card.className = "employee-card";
          card.dataset.funcionarioId = funcionario.id;
          card.innerHTML = `
            <div class="employee-header">
              <div class="employee-title">
                <div class="employee-title-main">
                  <div class="employee-name scroll-name" title="${nomeSafe}">${nomeSafe}</div>
                  <span class="badge ${statusOk ? "active" : "inactive"}">${statusOk ? "Ativo" : "Inativo"}</span>
                </div>
                <div class="employee-subline">ID: ${escapeHtml(funcionario.id || "--")}</div>
              </div>
              <div class="employee-actions">
                <button class="btn ghost employee-view-btn" data-action="view" data-id="${funcionario.id}">Ver detalhes</button>
                <button class="btn ghost" data-action="edit" data-id="${funcionario.id}">Editar</button>
                <button class="btn" data-action="toggle" data-id="${funcionario.id}">${statusOk ? "Inativar" : "Ativar"}</button>
                <button class="btn" data-action="delete" data-id="${funcionario.id}">Excluir</button>
              </div>
            </div>
            <div class="employee-quick-grid">
              <div class="employee-quick-item"><span>Matricula</span><strong>${matriculaSafe}</strong></div>
              <div class="employee-quick-item"><span>Contrato</span><strong class="scroll-name" title="${contratoSafe}">${contratoSafe}</strong></div>
              <div class="employee-quick-item"><span>Cidade</span><strong class="scroll-name" title="${localidadeSafe}">${localidadeSafe}</strong></div>
              <div class="employee-quick-item"><span>Abastecimentos</span><strong>${abastecimentos}</strong></div>
              <div class="employee-quick-item"><span>Consumo do mes</span><strong>${formatBRL(consumoMes)}</strong></div>
              <div class="employee-quick-item"><span>Saldo projetado</span><strong>${formatBRL(saldo)}</strong></div>
              <div class="employee-quick-item"><span>Uso do limite</span><strong>${utilizacao}%</strong></div>
            </div>
            <div class="employee-progress-track"><div class="employee-progress-fill" style="width:${utilizacao}%"></div></div>
            <div class="employee-progress-label">Limite ${formatBRL(limite)} | Uso no periodo ${utilizacao}%</div>
          `;
          elements.empresaFuncList.appendChild(card);
        });
      }

      function openEmpresaFuncionarioProfile(funcionarioId) {
        if (!elements.empresaFuncProfileModal) return;
        viewingEmpresaFuncionarioId = funcionarioId;
        renderEmpresaFuncionarioProfile();
        elements.empresaFuncProfileModal.classList.remove("hidden");
        elements.empresaFuncProfileModal.setAttribute("aria-hidden", "false");
      }

      function closeEmpresaFuncionarioProfile() {
        viewingEmpresaFuncionarioId = null;
        if (!elements.empresaFuncProfileModal) return;
        elements.empresaFuncProfileModal.classList.add("hidden");
        elements.empresaFuncProfileModal.setAttribute("aria-hidden", "true");
      }

      function renderEmpresaFuncionarioProfile() {
        if (!elements.empresaFuncProfileGrid || !elements.empresaFuncProfileFinance || !elements.empresaFuncProfileSub) return;
        if (!viewingEmpresaFuncionarioId || currentUser?.role !== "empresa") return;
        const funcionario = getFuncionario(viewingEmpresaFuncionarioId);
        if (!funcionario || funcionario.empresaId !== currentUser.empresaId) {
          closeEmpresaFuncionarioProfile();
          return;
        }

        const empresaId = currentUser.empresaId;
        const empresa = getEmpresa(empresaId);
        const monthRange = elements.empresaMonthFilter
          ? getMonthRangeFromInput(elements.empresaMonthFilter.value)
          : null;
        const rangeStart = monthRange?.start || null;
        const rangeEnd = monthRange?.end || null;
        let scopeTx = state.transacoes.filter((tx) => {
          if (tx.empresaId !== empresaId) return false;
          if (rangeStart && tx.timestamp < rangeStart) return false;
          if (rangeEnd && tx.timestamp > rangeEnd) return false;
          return true;
        });
        scopeTx = filterTransacoesByConvenio(scopeTx, empresaId);
        const confirmadas = scopeTx
          .filter((tx) => isTxConfirmed(tx) && tx.funcionarioId === funcionario.id)
          .slice()
          .sort((a, b) => b.timestamp - a.timestamp);

        const statusOk = isFuncionarioAtivo(funcionario);
        const salario = parseSalario(funcionario.salario);
        const limite = limiteFuncionario(funcionario.id);
        const consumo = confirmadas.reduce((sum, tx) => sum + Number(tx.valor || 0), 0);
        const saldo = Math.max(0, limite - consumo);
        const usoPct = limite > 0 ? Math.min(100, Math.round((consumo / limite) * 100)) : 0;
        const abastecimentos = confirmadas.length;
        const ultimaTx = confirmadas[0] || null;
        const postosDistintos = new Set(confirmadas.map((tx) => tx.postoId).filter(Boolean)).size;
        const topPostoEntry = Array.from(
          confirmadas.reduce((map, tx) => {
            const current = map.get(tx.postoId) || 0;
            map.set(tx.postoId, current + Number(tx.valor || 0));
            return map;
          }, new Map()).entries()
        )
          .sort((a, b) => b[1] - a[1])
          .shift();
        const topPosto = topPostoEntry ? getPosto(topPostoEntry[0]) : null;
        const topPostoNome = topPosto?.nome || "--";
        const topPostoValor = topPostoEntry ? Number(topPostoEntry[1] || 0) : 0;

        const nomeSafe = escapeHtml(funcionario.nome || "--");
        const matriculaSafe = escapeHtml(funcionario.matricula || "--");
        const cpfSafe = escapeHtml(funcionario.cpf || "--");
        const contratoSafe = escapeHtml(funcionario.contrato || "--");
        const localidadeSafe = escapeHtml(funcionario.localidade || "--");
        const emailSafe = escapeHtml(funcionario.email || "--");
        const telefoneSafe = escapeHtml(funcionario.telefone ? formatTelefoneInput(funcionario.telefone) : "--");
        const empresaLabel = empresa?.nome || "--";
        const empresaSafe = escapeHtml(empresaLabel);

        elements.empresaFuncProfileSub.textContent = `${empresaLabel} | Matricula ${funcionario.matricula || "--"} | ${
          statusOk ? "Ativo" : "Inativo"
        }`;
        elements.empresaFuncProfileGrid.innerHTML = `
          <div class="employee-profile-item">
            <span>Nome</span>
            <strong class="scroll-name" title="${nomeSafe}">${nomeSafe}</strong>
          </div>
          <div class="employee-profile-item">
            <span>Matricula</span>
            <strong>${matriculaSafe}</strong>
          </div>
          <div class="employee-profile-item">
            <span>CPF</span>
            <strong>${cpfSafe}</strong>
          </div>
          <div class="employee-profile-item">
            <span>Contrato</span>
            <strong class="scroll-name" title="${contratoSafe}">${contratoSafe}</strong>
          </div>
          <div class="employee-profile-item">
            <span>Cidade</span>
            <strong class="scroll-name" title="${localidadeSafe}">${localidadeSafe}</strong>
          </div>
          <div class="employee-profile-item">
            <span>Email</span>
            <strong class="scroll-name" title="${emailSafe}">${emailSafe}</strong>
          </div>
          <div class="employee-profile-item">
            <span>Telefone</span>
            <strong>${telefoneSafe}</strong>
          </div>
          <div class="employee-profile-item">
            <span>Salario mensal</span>
            <strong>${salario > 0 ? formatBRL(salario) : "--"}</strong>
          </div>
          <div class="employee-profile-item">
            <span>Empresa</span>
            <strong class="scroll-name" title="${empresaSafe}">${empresaSafe}</strong>
          </div>
          <div class="employee-profile-item">
            <span>Status</span>
            <strong>${statusOk ? "Ativo" : "Inativo"}</strong>
          </div>
        `;

        const historyHtml = confirmadas.slice(0, 6).map((tx) => {
          const postoNome = escapeHtml(getPosto(tx.postoId)?.nome || "--");
          return `
            <div class="employee-profile-history-item">
              <div>
                <strong class="scroll-name" title="${postoNome}">${postoNome}</strong>
                <div class="muted">${tx.id} | ${tx.timestamp.toLocaleString("pt-BR")}</div>
              </div>
              <strong>${formatBRL(tx.valor)}</strong>
            </div>
          `;
        });

        elements.empresaFuncProfileFinance.innerHTML = `
          <div class="employee-profile-metrics">
            <div class="employee-profile-item">
              <span>Limite no periodo</span>
              <strong>${formatBRL(limite)}</strong>
            </div>
            <div class="employee-profile-item">
              <span>Consumo confirmado</span>
              <strong>${formatBRL(consumo)}</strong>
            </div>
            <div class="employee-profile-item">
              <span>Saldo projetado</span>
              <strong>${formatBRL(saldo)}</strong>
            </div>
            <div class="employee-profile-item">
              <span>Abastecimentos</span>
              <strong>${abastecimentos}</strong>
            </div>
            <div class="employee-profile-item">
              <span>Postos utilizados</span>
              <strong>${postosDistintos}</strong>
            </div>
            <div class="employee-profile-item">
              <span>Posto principal</span>
              <strong>${escapeHtml(topPostoNome)} (${formatBRL(topPostoValor)})</strong>
            </div>
          </div>
          <div class="employee-progress-track">
            <div class="employee-progress-fill" style="width:${usoPct}%"></div>
          </div>
          <div class="employee-progress-label">
            Uso do limite: ${usoPct}%${ultimaTx ? ` | Ultimo abastecimento: ${ultimaTx.timestamp.toLocaleString("pt-BR")}` : ""}
          </div>
          <div class="section-divider"></div>
          <h3>Historico recente</h3>
          <div class="employee-profile-history">
            ${historyHtml.length ? historyHtml.join("") : '<div class="admin-insight-item muted">Sem abastecimentos confirmados no periodo.</div>'}
          </div>
        `;
      }

      function handleEmpresaFuncionarioListAction(event) {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const funcionarioId = button.dataset.id;
        const funcionario = getFuncionario(funcionarioId);
        if (!funcionario || funcionario.empresaId !== currentUser?.empresaId) return;
        const action = button.dataset.action;
        if (action === "view") {
          openEmpresaFuncionarioProfile(funcionarioId);
        } else if (action === "edit") {
          openFuncionarioModal(funcionario);
        } else if (action === "toggle") {
          handleEmpresaFuncionarioToggle(funcionarioId);
        } else if (action === "delete") {
          handleEmpresaFuncionarioDelete(funcionarioId);
        }
      }

      function handleFuncionarioModalSave() {
        if (currentUser?.role !== "empresa") return;
        const funcionario = getFuncionario(editingFuncionarioId);
        if (!funcionario || funcionario.empresaId !== currentUser.empresaId) {
          setMessage(elements.funcModalMsg, "Funcionario invalido.", "bad");
          return;
        }
        const nome = elements.funcModalNome.value.trim();
        const cpf = elements.funcModalCpf.value.trim();
        const matricula = elements.funcModalMatricula.value.trim();
        if (!nome || !cpf || !matricula) {
          setMessage(elements.funcModalMsg, "Preencha nome, CPF e matricula.", "bad");
          return;
        }
        const salario = parseSalario(elements.funcModalSalario.value.trim());
        const limiteConfig = getEmpresaLimiteConfig(getEmpresa(funcionario.empresaId));
        if (limiteConfig.tipo === "percentual" && (!salario || salario <= 0)) {
          setMessage(elements.funcModalMsg, "Informe o salario mensal. A empresa usa limite de 30% do salario, com maximo de R$ 890,00.", "bad");
          return;
        }
        const normalizedMatricula = normalizeMatricula(matricula);
        const matriculaValue = normalizedMatricula || matricula;
        const existing = getFuncionarioByMatricula(matriculaValue);
        if (existing && existing.id !== funcionario.id) {
          setMessage(elements.funcModalMsg, "Matricula ja usada por outro funcionario.", "bad");
          return;
        }
        funcionario.nome = nome;
        funcionario.cpf = cpf;
        funcionario.matricula = matriculaValue;
        funcionario.contrato = elements.funcModalContrato?.value.trim() || undefined;
        funcionario.localidade = elements.funcModalLocalidade.value.trim() || undefined;
        funcionario.email = elements.funcModalEmail.value.trim() || undefined;
        funcionario.telefone = normalizeTelefone(elements.funcModalTelefone.value.trim()) || undefined;
        funcionario.salario = salario > 0 ? salario : undefined;
        updateColaboradorAuthCpf(funcionario.id, cpf);
        logEvent("FUNCIONARIO_ATUALIZADO_EMPRESA", `${nome} - ${currentUser.empresaId}`);
        queueStateSave(true);
        setMessage(elements.funcModalMsg, "Funcionario atualizado.", "ok");
        closeFuncionarioModal();
        refreshFuncionarioViews();
      }

      function handleEmpresaFuncionarioToggle(funcionarioId) {
        if (currentUser?.role !== "empresa") return;
        const funcionario = getFuncionario(funcionarioId);
        if (!funcionario || funcionario.empresaId !== currentUser.empresaId) {
          setMessage(elements.empresaFuncListMsg, "Funcionario invalido.", "bad");
          return;
        }
        funcionario.ativo = !isFuncionarioAtivo(funcionario);
        logEvent("FUNCIONARIO_STATUS_EMPRESA", `${funcionario.nome} - ${funcionarioStatusLabel(funcionario)}`);
        queueStateSave(true);
        setMessage(
          elements.empresaFuncListMsg,
          `Funcionario ${funcionario.ativo ? "ativado" : "inativado"}.`,
          "ok"
        );
        refreshFuncionarioViews();
      }

      async function handleEmpresaFuncionarioDelete(funcionarioId) {
        if (currentUser?.role !== "empresa") return;
        const funcionario = getFuncionario(funcionarioId);
        if (!funcionario || funcionario.empresaId !== currentUser.empresaId) {
          setMessage(elements.empresaFuncListMsg, "Funcionario invalido.", "bad");
          return;
        }
        if (!window.confirm("Excluir funcionario? O cadastro e o acesso serao removidos, mas o historico financeiro sera preservado.")) {
          return;
        }
        const remoteDelete = await deleteFuncionarioOnServer(funcionarioId);
        if (remoteDelete.ok && remoteDelete.data) {
          applyStateSnapshot(remoteDelete.data);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteDelete.data));
          } catch (error) {
          }
          logEvent("FUNCIONARIO_EXCLUIDO_EMPRESA", `${funcionario.nome}`);
          setMessage(elements.empresaFuncListMsg, "Funcionario excluido.", "ok");
          refreshFuncionarioViews();
          return;
        }
        if (remoteDelete.skipped) {
          state.funcionarios = state.funcionarios.filter((f) => f.id !== funcionarioId);
          removeColaboradorAuthByFuncionario(funcionarioId);
          logEvent("FUNCIONARIO_EXCLUIDO_EMPRESA", `${funcionario.nome}`);
          queueStateSave(true);
          setMessage(elements.empresaFuncListMsg, "Funcionario excluido.", "ok");
          refreshFuncionarioViews();
          return;
        }
        setMessage(elements.empresaFuncListMsg, "Nao foi possivel excluir o funcionario no banco. Tente novamente.", "bad");
      }

      function refreshFuncionarioViews() {
        syncSelects();
        renderAdmin();
        renderEmpresaDashboard();
        renderReports();
        updateKpis();
        applyFuncionarioInativoState();
        if (viewingEmpresaFuncionarioId) {
          if (getFuncionario(viewingEmpresaFuncionarioId)) {
            renderEmpresaFuncionarioProfile();
          } else {
            closeEmpresaFuncionarioProfile();
          }
        }
      }

      function renderAdminTransacoes() {
        const empresaFiltro = elements.adminFilterEmpresa.value;
        const postoFiltro = elements.adminFilterPosto.value;
        elements.adminTransacoesTable.innerHTML = "";
        const filtradas = state.transacoes.filter((tx) => {
          const empresaOk = empresaFiltro === "all" || tx.empresaId === empresaFiltro;
          const postoOk = postoFiltro === "all" || tx.postoId === postoFiltro;
          return empresaOk && postoOk;
        });
        if (!filtradas.length) {
          const row = document.createElement("tr");
          row.innerHTML = `<td colspan="6" class="muted">Sem transacoes para o filtro.</td>`;
          elements.adminTransacoesTable.appendChild(row);
          return;
        }
        filtradas.forEach((tx) => {
          const funcionario = getFuncionario(tx.funcionarioId);
          const empresa = getEmpresa(tx.empresaId);
          const posto = getPosto(tx.postoId);
          const txId = escapeHtml(tx.id || "--");
          const funcionarioNome = escapeHtml(funcionario?.nome || "--");
          const empresaNome = escapeHtml(empresa?.nome || "--");
          const postoNome = escapeHtml(posto?.nome || "--");
          const row = document.createElement("tr");
          row.innerHTML = `<td>${txId}</td><td>${funcionarioNome}</td><td>${empresaNome}</td><td>${postoNome}</td><td>${formatBRL(tx.valor)}</td><td>${tx.timestamp.toLocaleString(
            "pt-BR"
          )}</td>`;
          elements.adminTransacoesTable.appendChild(row);
        });
      }

      function renderAuditLog() {
        elements.auditList.innerHTML = "";
        if (!state.logs.length) {
          const empty = document.createElement("div");
          empty.className = "list-item muted";
          empty.textContent = "Sem eventos registrados.";
          elements.auditList.appendChild(empty);
          return;
        }
        state.logs.slice(0, 8).forEach((log) => {
          const item = document.createElement("div");
          item.className = "list-item";
          item.innerHTML = `<div>${log.action}</div><div>${log.detail} - ${log.timestamp.toLocaleString(
            "pt-BR"
          )}</div>`;
          elements.auditList.appendChild(item);
        });
      }

      function renderAdmin() {
        if (currentUser?.role !== "admin") return;
        renderAdminSummary();
        renderAdminCadastros();
        renderAdminTransacoes();
        renderAuditLog();
      }

      function renderEmpresaLogo(empresa) {
        if (!elements.empresaLogoPreview || !elements.empresaLogoPlaceholder) return;
        if (empresa?.logoData) {
          elements.empresaLogoPreview.src = empresa.logoData;
          elements.empresaLogoPreview.classList.remove("hidden");
          elements.empresaLogoPlaceholder.classList.add("hidden");
        } else {
          elements.empresaLogoPreview.removeAttribute("src");
          elements.empresaLogoPreview.classList.add("hidden");
          elements.empresaLogoPlaceholder.classList.remove("hidden");
        }
      }

      async function handleEmpresaLogoUpload(event) {
        const empresa = getEmpresa(editingEmpresaId);
        if (!empresa) {
          setMessage(elements.empresaLogoMsg, "Selecione uma empresa para adicionar a logo.", "warn");
          elements.empresaLogoInput.value = "";
          return;
        }
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
          setMessage(elements.empresaLogoMsg, "Selecione uma imagem valida.", "bad");
          elements.empresaLogoInput.value = "";
          return;
        }
        try {
          const normalized = await normalizeBrandLogoFile(file);
          if (!normalized) throw new Error("logo_normalize_failed");
          empresa.logoData = normalized;
          const saved = await queueStateSave(true);
          setMessage(elements.empresaLogoMsg, saved ? "Logo atualizada e salva." : "Logo atualizada, mas houve falha ao salvar no banco.", saved ? "ok" : "warn");
          renderEmpresaLogo(empresa);
          renderAdmin();
          renderReports();
          updateHeaderBrand();
        } catch (error) {
          setMessage(elements.empresaLogoMsg, "Falha ao preparar a logo. Tente uma imagem PNG ou JPG.", "bad");
        }
        elements.empresaLogoInput.value = "";
      }

      function syncEmpresaProfileForm() {
        if (!elements.empresaSelfNome) return;
        if (currentUser?.role !== "empresa") {
          elements.empresaSelfNome.value = "";
          elements.empresaSelfCnpj.value = "";
          elements.empresaSelfFechamento.value = "";
          elements.empresaSelfEmail.value = "";
          elements.empresaSelfSenha.value = "";
          if (elements.empresaSelfId) {
            elements.empresaSelfId.textContent = "--";
          }
          if (elements.empresaSelfLoginStatus) {
            elements.empresaSelfLoginStatus.textContent = "Nao configurado";
          }
          return;
        }
        const empresa = getEmpresa(currentUser.empresaId);
        const empresaUser = empresa ? getEmpresaUser(empresa.id) : null;
        if (!empresa) {
          setMessage(elements.empresaSelfMsg, "Empresa nao encontrada para este acesso.", "bad");
          return;
        }
        elements.empresaSelfNome.value = empresa.nome || "";
        elements.empresaSelfCnpj.value = empresa.cnpj || "";
        elements.empresaSelfFechamento.value = empresa.fechamento || "";
        elements.empresaSelfEmail.value = empresaUser?.email || "";
        elements.empresaSelfSenha.value = "";
        if (elements.empresaSelfId) {
          elements.empresaSelfId.textContent = empresa.id || "--";
        }
        if (elements.empresaSelfLoginStatus) {
          elements.empresaSelfLoginStatus.textContent = empresaUser?.email || "Nao configurado";
        }
      }

      async function handleEmpresaSelfSave() {
        if (currentUser?.role !== "empresa") return;
        const empresa = getEmpresa(currentUser.empresaId);
        if (!empresa) {
          setMessage(elements.empresaSelfMsg, "Empresa nao encontrada para este acesso.", "bad");
          return;
        }
        const nome = String(elements.empresaSelfNome?.value || "").trim();
        if (!nome) {
          setMessage(elements.empresaSelfMsg, "Informe o nome da empresa.", "bad");
          return;
        }
        const cnpj = String(elements.empresaSelfCnpj?.value || "").trim();
        const fechamentoRaw = String(elements.empresaSelfFechamento?.value || "").trim();
        const fechamento = normalizeFechamento(fechamentoRaw || empresa.fechamento || "Dia 30");
        const loginEmail = String(elements.empresaSelfEmail?.value || "").trim();
        const loginSenha = String(elements.empresaSelfSenha?.value || "").trim();
        if (loginSenha) {
          const senhaRuleError = accessPasswordRuleError(loginSenha);
          if (senhaRuleError) {
            setMessage(elements.empresaSelfMsg, senhaRuleError, "bad");
            return;
          }
        }
        const empresaUser = getEmpresaUser(empresa.id);
        if (loginEmail) {
          const duplicate = getUsuarioByEmailInsensitive(loginEmail);
          if (duplicate && duplicate.id !== empresaUser?.id) {
            setMessage(elements.empresaSelfMsg, "Email ja utilizado em outro acesso.", "bad");
            return;
          }
        }
        if (loginSenha && !loginEmail) {
          setMessage(elements.empresaSelfMsg, "Informe o email para atualizar a senha.", "bad");
          return;
        }
        empresa.nome = nome;
        empresa.cnpj = cnpj || undefined;
        empresa.fechamento = fechamento;
        if (loginEmail) {
          if (empresaUser) {
            empresaUser.nome = nome;
            empresaUser.email = loginEmail;
            if (loginSenha) {
              empresaUser.senha = loginSenha;
            }
          } else {
            if (!loginSenha) {
              setMessage(elements.empresaSelfMsg, "Informe uma senha para criar o acesso da empresa.", "bad");
              return;
            }
            state.usuarios.push({
              id: generateId("U"),
              nome,
              email: loginEmail,
              senha: loginSenha,
              role: "empresa",
              empresaId: empresa.id,
            });
          }
        } else if (empresaUser) {
          empresaUser.nome = nome;
        }
        const saved = await queueStateSave(true);
        if (!saved) {
          setMessage(
            elements.empresaSelfMsg,
            `Dados atualizados localmente, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
            "warn"
          );
          return;
        }
        if (currentUser?.role === "empresa") {
          currentUser.nome = nome;
        }
        if (elements.empresaSelfSenha) {
          elements.empresaSelfSenha.value = "";
        }
        setMessage(elements.empresaSelfMsg, "Dados da empresa atualizados.", "ok");
        syncSelects();
        syncEmpresaProfileForm();
        renderUserChip(currentUser);
        updateHeaderBrand();
        renderReports();
        renderEmpresaDashboard();
      }

      function renderEmpresaConvenioDetails() {
        if (!elements.empresaConvenioDetailsBody) return;
        if (currentUser?.role !== "empresa") {
          elements.empresaConvenioDetailsBody.innerHTML = "";
          if (elements.empresaConvenioActiveCount) {
            elements.empresaConvenioActiveCount.textContent = "0";
          }
          if (elements.empresaConvenioTotalCount) {
            elements.empresaConvenioTotalCount.textContent = "0";
          }
          return;
        }
        const empresaId = currentUser.empresaId;
        const ids = getEmpresaConvenioIds(empresaId);
        const allPostos = Array.isArray(state.postos) ? state.postos : [];
        const conveniados =
          ids === null
            ? allPostos.slice()
            : allPostos.filter((posto) => Array.isArray(ids) && ids.includes(posto.id));
        if (elements.empresaConvenioActiveCount) {
          elements.empresaConvenioActiveCount.textContent = String(conveniados.length);
        }
        if (elements.empresaConvenioTotalCount) {
          elements.empresaConvenioTotalCount.textContent = String(allPostos.length);
        }
        elements.empresaConvenioDetailsBody.innerHTML = "";
        if (!conveniados.length) {
          const row = document.createElement("tr");
          row.innerHTML = `<td colspan="4" class="muted">Nenhum posto conveniado selecionado.</td>`;
          elements.empresaConvenioDetailsBody.appendChild(row);
          return;
        }
        conveniados
          .slice()
          .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"))
          .forEach((posto) => {
            const row = document.createElement("tr");
            row.innerHTML = `
              <td>${escapeHtml(posto.nome || "--")}</td>
              <td>${escapeHtml(posto.cnpj || "--")}</td>
              <td>${escapeHtml(posto.codigoMaquininha || "--")}</td>
              <td>${escapeHtml(formatPostoLocalizacao(posto))}</td>
            `;
            elements.empresaConvenioDetailsBody.appendChild(row);
          });
      }

      function renderEmpresaConvenioList() {
        if (!elements.empresaConvenioList) return;
        if (currentUser?.role !== "empresa") {
          elements.empresaConvenioList.innerHTML = "";
          renderEmpresaConvenioDetails();
          return;
        }
        const empresaId = currentUser.empresaId;
        const empresa = getEmpresa(empresaId);
        elements.empresaConvenioList.innerHTML = "";
        if (!empresa) {
          setMessage(elements.empresaConvenioMsg, "Empresa nao encontrada.", "bad");
          renderEmpresaConvenioDetails();
          return;
        }
        if (!state.postos.length) {
          elements.empresaConvenioList.innerHTML = '<div class="muted">Nenhum posto cadastrado.</div>';
          setMessage(elements.empresaConvenioMsg, "", "muted");
          renderEmpresaConvenioDetails();
          return;
        }
        const ids = getEmpresaConvenioIds(empresaId);
        const allowed = ids === null ? new Set(state.postos.map((p) => p.id)) : new Set(ids);
        state.postos.forEach((posto) => {
          const item = document.createElement("label");
          item.className = "convenio-item";
          const postoNome = escapeHtml(posto.nome || "--");
          const postoCnpj = escapeHtml(posto.cnpj || "CNPJ nao informado");
          item.innerHTML = `
            <input type="checkbox" data-posto-id="${posto.id}" ${allowed.has(posto.id) ? "checked" : ""} />
            <div>
              <strong class="scroll-name" title="${postoNome}">${postoNome}</strong>
              <div class="muted">${postoCnpj}</div>
            </div>
          `;
          elements.empresaConvenioList.appendChild(item);
        });
        if (ids !== null && ids.length === 0) {
          setMessage(
            elements.empresaConvenioMsg,
            "Nenhum posto selecionado. Colaboradores nao poderao abastecer.",
            "warn"
          );
        } else {
          setMessage(elements.empresaConvenioMsg, "", "muted");
        }
        renderEmpresaConvenioDetails();
      }

      function handleEmpresaConvenioSave() {
        if (currentUser?.role !== "empresa") return;
        const empresa = getEmpresa(currentUser.empresaId);
        if (!empresa || !elements.empresaConvenioList) return;
        const selected = Array.from(elements.empresaConvenioList.querySelectorAll("input[data-posto-id]"))
          .filter((input) => input.checked)
          .map((input) => input.dataset.postoId);
        empresa.postosConvenio = selected;
        queueStateSave(true);
        renderEmpresaDashboard();
        setMessage(
          elements.empresaConvenioMsg,
          selected.length ? "Postos conveniados atualizados." : "Nenhum posto selecionado. Colaboradores nao poderao abastecer.",
          selected.length ? "ok" : "warn"
        );
        syncSelects();
        renderReports();
        renderPostosList();
      }

      function syncEmpresaLimiteUi() {
        if (currentUser?.role !== "empresa") return;
        const empresa = getEmpresa(currentUser.empresaId);
        if (!empresa) return;
        const config = getEmpresaLimiteConfig(empresa);
        if (elements.empresaLimiteTipo) {
          elements.empresaLimiteTipo.value = config.tipo;
        }
        if (elements.empresaLimiteFixo) {
          elements.empresaLimiteFixo.value = config.valorFixo > 0 ? formatSalarioInput(config.valorFixo) : "";
        }
        if (elements.empresaLimiteFixoWrap) {
          elements.empresaLimiteFixoWrap.classList.toggle("hidden", config.tipo !== "fixo");
        }
        if (elements.empresaLimiteResumo) {
          const semSalario = state.funcionarios.filter(
            (funcionario) => funcionario.empresaId === empresa.id && parseSalario(funcionario.salario) <= 0
          ).length;
          const alerta = config.tipo === "percentual" && semSalario
            ? ` ${semSalario} colaborador(es) estao sem salario cadastrado e ficarao com limite R$ 0,00 ate o salario ser informado.`
            : "";
          elements.empresaLimiteResumo.textContent = `Regra atual: ${descricaoLimiteEmpresa(empresa)}.${alerta}`;
        }
      }

      async function handleEmpresaLimiteSave() {
        if (currentUser?.role !== "empresa") return;
        const empresa = getEmpresa(currentUser.empresaId);
        if (!empresa) {
          setMessage(elements.empresaLimiteMsg, "Empresa invalida.", "bad");
          return;
        }
        const tipo = elements.empresaLimiteTipo?.value === "fixo" ? "fixo" : "percentual";
        let valorFixo = getEmpresaLimiteConfig(empresa).valorFixo;
        if (tipo === "fixo") {
          valorFixo = parseCurrencyInput(elements.empresaLimiteFixo?.value || "");
          if (!Number.isFinite(valorFixo) || valorFixo <= 0) {
            setMessage(elements.empresaLimiteMsg, "Informe um valor fixo maior que zero.", "bad");
            return;
          }
        }
        empresa.limiteTipo = tipo;
        empresa.limitePercentual = 30;
        empresa.limiteTeto = LIMITE_MAXIMO_CREDITO;
        empresa.limiteValorFixo = Math.round(valorFixo * 100) / 100;
        empresa.limiteMensal = empresa.limiteValorFixo;
        const saved = await queueStateSave(true);
        setMessage(
          elements.empresaLimiteMsg,
          saved ? "Regra de limite salva e aplicada a todos os colaboradores." : `Regra alterada localmente, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
          saved ? "ok" : "warn"
        );
        logEvent("LIMITE_EMPRESA_ATUALIZADO", `${empresa.nome} - ${descricaoLimiteEmpresa(empresa)}`);
        syncEmpresaLimiteUi();
        refreshAllViews();
      }

      function renderEmpresaDashboard() {
        if (currentUser?.role !== "empresa") return;
        const empresaId = currentUser.empresaId;
        const empresa = getEmpresa(empresaId);
        if (!empresa) return;
        syncEmpresaLimiteUi();
        syncEmpresaProfileForm();
        ensureEmpresaMonthFilter();
        const monthRange = elements.empresaMonthFilter
          ? getMonthRangeFromInput(elements.empresaMonthFilter.value)
          : null;
        const rangeStart = monthRange?.start || null;
        const rangeEnd = monthRange?.end || null;
        const funcionarios = state.funcionarios.filter((f) => f.empresaId === empresaId);
        const funcionariosAtivos = funcionarios.filter((f) => isFuncionarioAtivo(f));
        let transacoes = state.transacoes.filter((tx) => {
          if (tx.empresaId !== empresaId) return false;
          if (rangeStart && tx.timestamp < rangeStart) return false;
          if (rangeEnd && tx.timestamp > rangeEnd) return false;
          return true;
        });
        transacoes = filterTransacoesByConvenio(transacoes, empresaId);
        const transacoesConfirmadas = transacoes.filter((tx) => isTxConfirmed(tx));
        const statsByFuncionario = new Map();
        transacoesConfirmadas.forEach((tx) => {
          const current = statsByFuncionario.get(tx.funcionarioId) || { total: 0, count: 0 };
          current.total += Number(tx.valor || 0);
          current.count += 1;
          statsByFuncionario.set(tx.funcionarioId, current);
        });
        const total = transacoesConfirmadas.reduce((sum, tx) => sum + tx.valor, 0);
        const limiteTotal = funcionarios.reduce((sum, f) => sum + limiteFuncionario(f.id), 0);
        const saldoTotal = Math.max(0, limiteTotal - total);
        const funcionariosInativos = funcionarios.filter((f) => !isFuncionarioAtivo(f));
        const saldoZerado = funcionarios.filter((func) => {
          const stats = statsByFuncionario.get(func.id) || { total: 0, count: 0 };
          const saldo = Math.max(0, limiteFuncionario(func.id) - stats.total);
          return saldo <= 0;
        }).length;
        const ticketMedio = transacoesConfirmadas.length ? total / transacoesConfirmadas.length : 0;
        const utilizacao = limiteTotal > 0 ? Math.min(100, Math.round((total / limiteTotal) * 100)) : 0;
        const convenioIds = getEmpresaConvenioIds(empresaId);
        const postosConveniados = convenioIds === null ? state.postos.length : convenioIds.length;

        const empresaLabel = empresa?.nome || "--";
        const empresaCnpj = empresa?.cnpj ? ` | CNPJ: ${empresa.cnpj}` : "";
        elements.empresaDashboardNome.textContent = `Empresa: ${empresaLabel}${empresaCnpj}`;
        elements.empresaKpiFuncionarios.textContent = funcionariosAtivos.length;
        if (elements.empresaKpiFuncionariosInativos) {
          elements.empresaKpiFuncionariosInativos.textContent = funcionariosInativos.length;
        }
        if (elements.empresaKpiSaldoZerado) {
          elements.empresaKpiSaldoZerado.textContent = saldoZerado;
        }
        elements.empresaKpiTransacoes.textContent = transacoesConfirmadas.length;
        elements.empresaKpiTotal.textContent = formatBRL(total);
        elements.empresaKpiLimite.textContent = formatBRL(limiteTotal);
        elements.empresaKpiSaldo.textContent = formatBRL(saldoTotal);
        if (elements.empresaKpiTicketMedio) {
          elements.empresaKpiTicketMedio.textContent = formatBRL(ticketMedio);
        }
        if (elements.empresaKpiUtilizacao) {
          elements.empresaKpiUtilizacao.textContent = `Uso do limite: ${utilizacao}%`;
        }
        if (elements.empresaKpiPostos) {
          elements.empresaKpiPostos.textContent = String(postosConveniados);
        }
        const proximaRecomposicao = getProximaRecomposicaoSaldo(empresa);
        if (elements.empresaKpiReset) {
          elements.empresaKpiReset.textContent = formatDataLongaBR(proximaRecomposicao);
        }
        if (elements.empresaKpiResetNote) {
          elements.empresaKpiResetNote.textContent = `Fechamento: ${normalizeFechamento(empresa.fechamento)}`;
        }
        if (elements.empresaLimiteResetInfo) {
          elements.empresaLimiteResetInfo.textContent = `O saldo utilizado e recomposto automaticamente em ${formatDataLongaBR(proximaRecomposicao)} (${normalizeFechamento(empresa.fechamento)}).`;
        }

        elements.empresaConsumoTable.innerHTML = "";
        if (!funcionarios.length) {
          const row = document.createElement("tr");
          row.innerHTML = `<td colspan="3" class="muted">Sem funcionarios cadastrados.</td>`;
          elements.empresaConsumoTable.appendChild(row);
          if (elements.empresaConsumoNote) elements.empresaConsumoNote.textContent = "Sem colaboradores cadastrados.";
        } else {
          const consumoOrdenado = funcionarios
            .slice()
            .sort((a, b) => {
              const aStats = statsByFuncionario.get(a.id) || { total: 0, count: 0 };
              const bStats = statsByFuncionario.get(b.id) || { total: 0, count: 0 };
              return bStats.total - aStats.total || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
            });
          const previewLimit = 50;
          consumoOrdenado.slice(0, previewLimit).forEach((func) => {
            const stats = statsByFuncionario.get(func.id) || { total: 0, count: 0 };
            const statusLabel = isFuncionarioAtivo(func) ? "" : " (Inativo)";
            const nome = `${func.nome || "--"}${statusLabel}`;
            const row = document.createElement("tr");
            row.innerHTML = `<td><span class="scroll-name" title="${escapeHtml(nome)}">${escapeHtml(nome)}</span></td><td>${stats.count}</td><td>${formatBRL(stats.total)}</td>`;
            elements.empresaConsumoTable.appendChild(row);
          });
          if (elements.empresaConsumoNote) {
            elements.empresaConsumoNote.textContent = funcionarios.length > previewLimit
              ? `Mostrando os ${previewLimit} maiores consumos de ${funcionarios.length} colaboradores. Use a area Equipe para consultar todos.`
              : `Mostrando ${funcionarios.length} colaborador(es) no periodo.`;
          }
        }

        if (elements.empresaTopList) {
          elements.empresaTopList.innerHTML = "";
          const ranking = funcionarios
            .map((func) => {
              const stats = statsByFuncionario.get(func.id) || { total: 0, count: 0 };
              return {
                funcionario: func,
                total: stats.total,
                count: stats.count,
              };
            })
            .sort(
              (a, b) =>
                b.total - a.total ||
                String(a.funcionario?.nome || "").localeCompare(String(b.funcionario?.nome || ""), "pt-BR")
            )
            .slice(0, 6);
          const hasConsumo = ranking.some((entry) => entry.total > 0);
          if (!ranking.length || !hasConsumo) {
            elements.empresaTopList.innerHTML = '<div class="muted">Sem consumo confirmado no periodo.</div>';
          } else {
            ranking.forEach((entry, index) => {
              const item = document.createElement("div");
              item.className = "empresa-top-item";
              const nome = escapeHtml(entry.funcionario?.nome || "--");
              item.innerHTML = `
                <span class="empresa-top-rank">${index + 1}</span>
                <div>
                  <div class="scroll-name" title="${nome}">${nome}</div>
                  <div class="muted">${entry.count} abastecimento(s)</div>
                </div>
                <div class="empresa-top-amount">${formatBRL(entry.total)}</div>
              `;
              elements.empresaTopList.appendChild(item);
            });
          }
        }

        renderEmpresaConvenioList();
        renderEmpresaFuncionariosList(transacoesConfirmadas);
        if (viewingEmpresaFuncionarioId) {
          renderEmpresaFuncionarioProfile();
        }
      }
      function renderPostoDashboard() {
        if (currentUser?.role !== "posto") return;
        const posto = getPostoUser();
        const empresaTableBody = elements.postoEmpresaTable?.querySelector("tbody") || elements.postoEmpresaTable;
        if (!posto) {
          if (elements.postoDashboardNome) {
            elements.postoDashboardNome.textContent = "Posto: --";
          }
          if (elements.postoKpiTransacoes) {
            elements.postoKpiTransacoes.textContent = "0";
          }
          if (elements.postoKpiPendentes) {
            elements.postoKpiPendentes.textContent = "0";
          }
          if (elements.postoKpiConfirmadas) {
            elements.postoKpiConfirmadas.textContent = "0";
          }
          if (elements.postoKpiTotal) {
            elements.postoKpiTotal.textContent = formatBRL(0);
          }
          if (elements.postoKpiTicket) {
            elements.postoKpiTicket.textContent = formatBRL(0);
          }
          if (elements.postoKpiEmpresas) {
            elements.postoKpiEmpresas.textContent = "0";
          }
          if (elements.postoKpiMaiorEmpresa) {
            elements.postoKpiMaiorEmpresa.textContent = "--";
          }
          if (elements.postoTransacoesList) {
            elements.postoTransacoesList.innerHTML = "";
          }
          if (elements.postoTransacoesMsg) {
            setMessage(elements.postoTransacoesMsg, "Posto nao encontrado para este acesso.", "warn");
          }
          if (empresaTableBody) {
            empresaTableBody.innerHTML = "";
          }
          if (elements.postoPendentesList) {
            elements.postoPendentesList.innerHTML = "";
          }
          if (elements.postoPendentesMsg) {
            setMessage(elements.postoPendentesMsg, "Sem pendencias.", "muted");
          }
          if (elements.postoOpenLeitor) {
            elements.postoOpenLeitor.classList.add("hidden");
          }
          return;
        }
        if (elements.postoDashboardNome) {
          elements.postoDashboardNome.textContent = `Posto: ${posto.nome || "--"}`;
        }
        ensurePostoMonthFilter();
        const monthRange = elements.postoMonthFilter
          ? getMonthRangeFromInput(elements.postoMonthFilter.value)
          : null;
        const rangeStart = monthRange?.start || null;
        const rangeEnd = monthRange?.end || null;
        let transacoes = state.transacoes.filter((tx) => {
          if (tx.postoId !== posto.id) return false;
          if (rangeStart && tx.timestamp < rangeStart) return false;
          if (rangeEnd && tx.timestamp > rangeEnd) return false;
          return true;
        });
        if (elements.postoEmpresaFilter) {
          const currentFilter = elements.postoEmpresaFilter.value || "all";
          fillSelectWithAll(elements.postoEmpresaFilter, state.empresas, (e) => e.nome, currentFilter);
          const selected = elements.postoEmpresaFilter.value;
          if (selected && selected !== "all") {
            transacoes = transacoes.filter((tx) => tx.empresaId === selected);
          }
        }
        const pendentes = transacoes.filter((tx) => isTxPending(tx));
        const transacoesConfirmadas = transacoes.filter((tx) => isTxConfirmed(tx));
        const total = transacoesConfirmadas.reduce((sum, tx) => sum + Number(tx.valor || 0), 0);
        const ticket = transacoesConfirmadas.length ? total / transacoesConfirmadas.length : 0;
        const consumoPorEmpresa = new Map();
        transacoesConfirmadas.forEach((tx) => {
          const current = consumoPorEmpresa.get(tx.empresaId) || { total: 0, count: 0 };
          current.total += Number(tx.valor || 0);
          current.count += 1;
          consumoPorEmpresa.set(tx.empresaId, current);
        });
        const empresasAtendidas = consumoPorEmpresa.size;
        const topEmpresaEntry = Array.from(consumoPorEmpresa.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .shift();
        const topEmpresaName = topEmpresaEntry ? getEmpresa(topEmpresaEntry[0])?.nome || "--" : "--";
        if (elements.postoKpiTransacoes) {
          elements.postoKpiTransacoes.textContent = String(transacoes.length);
        }
        if (elements.postoKpiPendentes) {
          elements.postoKpiPendentes.textContent = String(pendentes.length);
        }
        if (elements.postoKpiConfirmadas) {
          elements.postoKpiConfirmadas.textContent = String(transacoesConfirmadas.length);
        }
        if (elements.postoKpiTotal) {
          elements.postoKpiTotal.textContent = formatBRL(total);
        }
        if (elements.postoKpiTicket) {
          elements.postoKpiTicket.textContent = formatBRL(ticket);
        }
        if (elements.postoKpiEmpresas) {
          elements.postoKpiEmpresas.textContent = String(empresasAtendidas);
        }
        if (elements.postoKpiMaiorEmpresa) {
          elements.postoKpiMaiorEmpresa.textContent = topEmpresaName;
        }
        if (elements.postoOpenLeitor) {
          elements.postoOpenLeitor.href = `leitor.html?posto=${encodeURIComponent(posto.id)}`;
          elements.postoOpenLeitor.classList.remove("hidden");
        }
        if (empresaTableBody) {
          empresaTableBody.innerHTML = "";
          const ranking = Array.from(consumoPorEmpresa.entries())
            .map(([empresaId, data]) => ({
              empresa: getEmpresa(empresaId),
              total: data.total,
              count: data.count,
            }))
            .sort((a, b) => b.total - a.total);
          if (!ranking.length) {
            const row = document.createElement("tr");
            row.innerHTML = `<td colspan="3" class="muted">Sem transacoes confirmadas para o periodo.</td>`;
            empresaTableBody.appendChild(row);
          } else {
            ranking.forEach((entry) => {
              const nomeEmpresa = escapeHtml(entry.empresa?.nome || "--");
              const row = document.createElement("tr");
              row.innerHTML = `
                <td><span class="scroll-name" title="${nomeEmpresa}">${nomeEmpresa}</span></td>
                <td>${entry.count}</td>
                <td>${formatBRL(entry.total)}</td>
              `;
              empresaTableBody.appendChild(row);
            });
          }
        }
        if (elements.postoTransacoesList && elements.postoTransacoesMsg) {
          elements.postoTransacoesList.innerHTML = "";
          if (!transacoes.length) {
            setMessage(elements.postoTransacoesMsg, "Nenhuma transacao registrada para este posto.", "muted");
          } else {
            setMessage(elements.postoTransacoesMsg, "", "muted");
            transacoes
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 8)
              .forEach((tx) => {
                const funcionario = getFuncionario(tx.funcionarioId);
                const empresa = getEmpresa(tx.empresaId);
                const statusBadge = `<span class="tx-status ${txStatusClass(tx)}">${txStatusLabel(tx)}</span>`;
                const nomeFuncionario = escapeHtml(funcionario?.nome || "--");
                const nomeEmpresa = escapeHtml(empresa?.nome || "--");
                const item = document.createElement("div");
                item.className = `list-item ${isTxPending(tx) ? "pending" : ""}`;
                item.innerHTML = `
                  <div>
                    <div class="scroll-name" title="${nomeFuncionario}">${nomeFuncionario}</div>
                    <div class="muted">${nomeEmpresa} | Combustível: ${escapeHtml(tx.combustivel || "Não informado")} | ${tx.id} | ${tx.timestamp.toLocaleString("pt-BR")}</div>
                  </div>
                  <div class="tx-meta">
                    <strong>${formatBRL(tx.valor)}</strong>
                    ${statusBadge}
                  </div>
                `;
                elements.postoTransacoesList.appendChild(item);
              });
          }
        }
        if (elements.postoPendentesList && elements.postoPendentesMsg) {
          elements.postoPendentesList.innerHTML = "";
          if (!pendentes.length) {
            setMessage(elements.postoPendentesMsg, "Sem pendencias de confirmacao no periodo.", "muted");
          } else {
            setMessage(
              elements.postoPendentesMsg,
              `${pendentes.length} pendencia(s) aguardando confirmacao do colaborador.`,
              "warn"
            );
            pendentes
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 8)
              .forEach((tx) => {
                const funcionario = getFuncionario(tx.funcionarioId);
                const empresa = getEmpresa(tx.empresaId);
                const nomeFuncionario = escapeHtml(funcionario?.nome || "--");
                const nomeEmpresa = escapeHtml(empresa?.nome || "--");
                const item = document.createElement("div");
                item.className = "posto-pendente-item";
                item.innerHTML = `
                  <div class="posto-pendente-meta">
                    <strong class="scroll-name" title="${nomeFuncionario}">${nomeFuncionario}</strong>
                    <div class="muted">${nomeEmpresa} | ${tx.id} | ${tx.timestamp.toLocaleString("pt-BR")}</div>
                  </div>
                  <div class="posto-pendente-valor">${formatBRL(tx.valor)}</div>
                `;
                elements.postoPendentesList.appendChild(item);
              });
          }
        }
      }

      async function handleEmpresaFuncionarioAdd() {
        if (currentUser?.role !== "empresa") return;
        const empresaId = currentUser.empresaId;
        const nome = elements.empresaFuncNome.value.trim();
        const cpf = elements.empresaFuncCpf.value.trim();
        const matricula = elements.empresaFuncMatricula.value.trim();
        const contrato = elements.empresaFuncContrato?.value.trim() || "";
        const localidade = elements.empresaFuncLocalidade.value.trim();
        if (!nome || !cpf || !matricula) {
          setMessage(elements.empresaFuncMsg, "Preencha nome, CPF e matricula.", "bad");
          return;
        }
        const salario = parseSalario(elements.empresaFuncSalario.value.trim());
        const limiteConfig = getEmpresaLimiteConfig(getEmpresa(empresaId));
        if (limiteConfig.tipo === "percentual" && (!salario || salario <= 0)) {
          setMessage(elements.empresaFuncMsg, "Informe o salario mensal. A empresa usa limite de 30% do salario, com maximo de R$ 890,00.", "bad");
          return;
        }
        const senha = elements.empresaFuncSenha.value.trim();
        const txPin = elements.empresaFuncTxPin.value.trim();
        const normalizedMatricula = normalizeMatricula(matricula);
        const normalizedCpf = normalizeCpf(cpf);
        if ((senha || txPin) && getColaboradorAuthByCpf(normalizedCpf)) {
          setMessage(elements.empresaFuncMsg, "CPF ja possui cadastro ativo.", "bad");
          return;
        }
        if (senha) {
          const senhaRuleError = accessPasswordRuleError(senha);
          if (senhaRuleError) {
            setMessage(elements.empresaFuncMsg, senhaRuleError, "bad");
            return;
          }
        }
        if (txPin && !/^\d{4}$/.test(txPin)) {
          setMessage(elements.empresaFuncMsg, "Senha de transacao deve ter 4 digitos.", "bad");
          return;
        }
        if (txPin && !senha) {
          setMessage(elements.empresaFuncMsg, "Informe a senha de acesso para cadastrar a senha de transacao.", "bad");
          return;
        }
        const email = elements.empresaFuncEmail.value.trim();
        const telefone = normalizeTelefone(elements.empresaFuncTelefone.value.trim());
        const funcionario = {
          id: generateId("F"),
          nome,
          cpf,
          matricula: normalizedMatricula || matricula,
          empresaId,
          ativo: true,
          contrato: contrato || undefined,
          localidade: localidade || undefined,
          email: email || undefined,
          telefone: telefone || undefined,
          salario: salario > 0 ? salario : undefined,
        };
        state.funcionarios.push(funcionario);
        if (senha) {
          state.colaboradoresAuth.push({
            id: generateId("COL"),
            funcionarioId: funcionario.id,
            cpf: normalizedCpf,
            senha,
            senhaTransacao: txPin || undefined,
          });
        }
        const saved = await queueStateSave(true);

        elements.empresaFuncNome.value = "";
        elements.empresaFuncCpf.value = "";
        elements.empresaFuncMatricula.value = "";
        if (elements.empresaFuncContrato) elements.empresaFuncContrato.value = "";
        elements.empresaFuncLocalidade.value = "";
        elements.empresaFuncEmail.value = "";
        elements.empresaFuncTelefone.value = "";
        elements.empresaFuncSalario.value = "";
        elements.empresaFuncSenha.value = "";
        elements.empresaFuncTxPin.value = "";
        setMessage(
          elements.empresaFuncMsg,
          saved
            ? "Funcionario adicionado."
            : `Funcionario adicionado localmente, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
          saved ? "ok" : "warn"
        );
        logEvent("FUNCIONARIO_CRIADO_EMPRESA", `${nome} - ${empresaId}`);
        syncSelects();
        renderReports();
        renderEmpresaDashboard();
      }

      async function handleEmpresaAdd() {
        const nome = elements.empresaNomeInput.value.trim();
        if (!nome) {
          setMessage(elements.empresaMsg, "Informe o nome da empresa.", "bad");
          return;
        }
        const cnpj = elements.empresaCnpjInput.value.trim();
        const fechamentoRaw = elements.empresaFechamentoInput.value.trim();
        const fechamento = normalizeFechamento(fechamentoRaw || "Dia 30");
        const limiteTipo = elements.empresaLimiteTipoAdmin?.value === "fixo" ? "fixo" : "percentual";
        let limiteValorFixo = state.limitePadrao;
        if (limiteTipo === "fixo") {
          limiteValorFixo = parseCurrencyInput(elements.empresaLimiteFixoAdmin?.value || "");
          if (!Number.isFinite(limiteValorFixo) || limiteValorFixo <= 0) {
            setMessage(elements.empresaMsg, "Informe um valor fixo maior que zero.", "bad");
            return;
          }
        }
        limiteValorFixo = Math.round(limiteValorFixo * 100) / 100;
        const loginEmail = elements.empresaLoginEmail.value.trim();
        const loginSenha = elements.empresaLoginSenha.value.trim();
        if ((loginEmail && !loginSenha) || (!loginEmail && loginSenha)) {
          setMessage(elements.empresaMsg, "Informe email e senha para criar o acesso.", "bad");
          return;
        }
        if (loginSenha) {
          const senhaRuleError = accessPasswordRuleError(loginSenha);
          if (senhaRuleError) {
            setMessage(elements.empresaMsg, senhaRuleError, "bad");
            return;
          }
        }
        if (loginEmail && getUsuarioByEmailInsensitive(loginEmail)) {
          setMessage(elements.empresaMsg, "Email ja utilizado em outro acesso.", "bad");
          return;
        }
        if (!DEMO_MODE && window.location.protocol !== "file:") {
          const remoteCreate = await createEmpresaOnServer({
            nome,
            cnpj,
            fechamento,
            limiteTipo,
            limiteValorFixo,
            loginEmail,
            loginSenha,
          });
          if (!remoteCreate.ok) {
            const map = {
              email_in_use: "Email ja utilizado em outro acesso.",
              invalid_nome: "Informe o nome da empresa.",
              invalid_login_pair: "Informe email e senha para criar o acesso.",
              invalid_limite_fixo: "Informe um valor fixo maior que zero.",
              db_write_failed: "Falha ao salvar no banco de dados.",
              db_encode_failed: "Falha ao preparar os dados para salvar no banco.",
              network_error: "Falha de conexao ao salvar no banco.",
            };
            setMessage(
              elements.empresaMsg,
              map[remoteCreate.error] || `Falha ao salvar no banco (${remoteCreate.error || "erro_desconhecido"}).`,
              "bad"
            );
            return;
          }
          if (remoteCreate.data) {
            applyStateSnapshot(remoteCreate.data);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteCreate.data));
            } catch (error) {
            }
          }
          elements.empresaNomeInput.value = "";
          elements.empresaCnpjInput.value = "";
          elements.empresaFechamentoInput.value = "";
          elements.empresaLimiteTipoAdmin.value = "percentual";
          elements.empresaLimiteFixoAdmin.value = "";
          elements.empresaLimiteFixoAdminWrap.classList.add("hidden");
          elements.empresaLoginEmail.value = "";
          elements.empresaLoginSenha.value = "";
          setMessage(
            elements.empresaMsg,
            remoteCreate.warning === "state_write_failed"
              ? "Empresa adicionada com sucesso (fallback de persistencia aplicado)."
              : "Empresa adicionada com sucesso.",
            "ok"
          );
          logEvent("EMPRESA_CRIADA", nome);
          syncSelects();
          renderAdmin();
          renderEmpresaDashboard();
          renderReports();
          return;
        }
        const empresaId = generateId("E");
        const postosConvenio = state.postos.map((posto) => posto.id);
        state.empresas.push({
          id: empresaId,
          nome,
          cnpj: cnpj || undefined,
          fechamento,
          limiteTipo,
          limitePercentual: 30,
          limiteTeto: LIMITE_MAXIMO_CREDITO,
          limiteValorFixo,
          limiteMensal: limiteValorFixo,
          postosConvenio,
        });
        if (loginEmail && loginSenha) {
          state.usuarios.push({
            id: generateId("U"),
            nome,
            email: loginEmail,
            senha: loginSenha,
            role: "empresa",
            empresaId,
          });
        }
        const saved = await queueStateSave(true);
        elements.empresaNomeInput.value = "";
        elements.empresaCnpjInput.value = "";
        elements.empresaFechamentoInput.value = "";
        elements.empresaLimiteTipoAdmin.value = "percentual";
        elements.empresaLimiteFixoAdmin.value = "";
        elements.empresaLimiteFixoAdminWrap.classList.add("hidden");
        elements.empresaLoginEmail.value = "";
        elements.empresaLoginSenha.value = "";
        setMessage(
          elements.empresaMsg,
          saved
            ? "Empresa adicionada com sucesso."
            : `Empresa adicionada localmente, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
          saved ? "ok" : "warn"
        );
        logEvent("EMPRESA_CRIADA", nome);
        syncSelects();
        renderAdmin();
        renderEmpresaDashboard();
        renderReports();
      }

      async function handleFuncionarioAdd() {
        const nome = elements.funcNomeInput.value.trim();
        const cpf = elements.funcCpfInput.value.trim();
        const matricula = elements.funcMatriculaInput.value.trim();
        const empresaId = elements.funcEmpresaSelect.value;
        const contrato = elements.funcContratoInput?.value.trim() || "";
        const localidade = elements.funcLocalidadeInput.value.trim();
        if (!nome || !cpf || !matricula || !empresaId) {
          setMessage(elements.funcMsgAdmin, "Preencha nome, CPF, matricula e empresa.", "bad");
          return;
        }
        const salario = parseSalario(elements.funcSalarioInput.value.trim());
        const limiteConfig = getEmpresaLimiteConfig(getEmpresa(empresaId));
        if (limiteConfig.tipo === "percentual" && (!salario || salario <= 0)) {
          setMessage(elements.funcMsgAdmin, "Informe o salario mensal. A empresa usa limite de 30% do salario, com maximo de R$ 890,00.", "bad");
          return;
        }
        const senha = elements.funcSenhaInput.value.trim();
        const txPin = elements.funcTxPinInput.value.trim();
        const normalizedMatricula = normalizeMatricula(matricula);
        const normalizedCpf = normalizeCpf(cpf);
        if ((senha || txPin) && getColaboradorAuthByCpf(normalizedCpf)) {
          setMessage(elements.funcMsgAdmin, "CPF ja possui cadastro ativo.", "bad");
          return;
        }
        if (senha) {
          const senhaRuleError = accessPasswordRuleError(senha);
          if (senhaRuleError) {
            setMessage(elements.funcMsgAdmin, senhaRuleError, "bad");
            return;
          }
        }
        if (txPin && !/^\d{4}$/.test(txPin)) {
          setMessage(elements.funcMsgAdmin, "Senha de transacao deve ter 4 digitos.", "bad");
          return;
        }
        if (txPin && !senha) {
          setMessage(elements.funcMsgAdmin, "Informe a senha de acesso para cadastrar a senha de transacao.", "bad");
          return;
        }
        const email = elements.funcEmailInput.value.trim();
        const telefone = normalizeTelefone(elements.funcTelefoneInput.value.trim());
        const funcionario = {
          id: generateId("F"),
          nome,
          cpf,
          matricula: normalizedMatricula || matricula,
          empresaId,
          ativo: true,
          contrato: contrato || undefined,
          localidade: localidade || undefined,
          email: email || undefined,
          telefone: telefone || undefined,
          salario: salario > 0 ? salario : undefined,
        };
        state.funcionarios.push(funcionario);
        if (senha) {
          state.colaboradoresAuth.push({
            id: generateId("COL"),
            funcionarioId: funcionario.id,
            cpf: normalizedCpf,
            senha,
            senhaTransacao: txPin || undefined,
          });
        }
        const saved = await queueStateSave(true);
        elements.funcNomeInput.value = "";
        elements.funcCpfInput.value = "";
        elements.funcMatriculaInput.value = "";
        if (elements.funcContratoInput) elements.funcContratoInput.value = "";
        elements.funcLocalidadeInput.value = "";
        elements.funcEmailInput.value = "";
        elements.funcTelefoneInput.value = "";
        elements.funcSalarioInput.value = "";
        elements.funcSenhaInput.value = "";
        elements.funcTxPinInput.value = "";
        setMessage(
          elements.funcMsgAdmin,
          saved
            ? "Funcionario adicionado."
            : `Funcionario adicionado localmente, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
          saved ? "ok" : "warn"
        );
        logEvent("FUNCIONARIO_CRIADO", `${nome} - ${empresaId}`);
        syncSelects();
        renderAdmin();
        renderEmpresaDashboard();
        renderReports();
      }

      async function handlePostoCapture() {
        let text = "";
        if (navigator.clipboard?.readText) {
          try {
            text = await navigator.clipboard.readText();
          } catch (error) {
            text = "";
          }
        }
        if (!text) {
          text = window.prompt("Cole o link do Maps para salvar a localizacao.");
        }
        if (!text) {
          setMessage(elements.postoMsgAdmin, "Nenhum link informado.", "warn");
          return;
        }
        elements.postoLocalizacaoInput.value = text.trim();
        updatePostoPreviewLink();
        setMessage(elements.postoMsgAdmin, "Link do Maps colado.", "ok");
      }

      function updatePostoPreviewLink() {
        const localizacao = elements.postoLocalizacaoInput.value.trim();
        const url = buildMapsUrlFromLocation(localizacao);
        if (!url) {
          elements.postoPreviewLink.classList.add("hidden");
          elements.postoPreviewLink.removeAttribute("href");
          return;
        }
        elements.postoPreviewLink.href = url;
        elements.postoPreviewLink.classList.remove("hidden");
      }

      async function handlePostoAdd() {
        const codigoDigitado = elements.postoCodigoInput.value.trim();
        const codigo = codigoDigitado || generateUniqueCodigoMaquininha();
        const acesso = elements.postoAcessoInput.value.trim();
        if (!acesso || acesso.length < 4) {
          setMessage(elements.postoMsgAdmin, "Informe o codigo de acesso da maquininha.", "bad");
          return;
        }
        if (isCodigoMaquininhaDuplicado(codigo)) {
          setMessage(elements.postoMsgAdmin, "Codigo de maquininha ja cadastrado.", "bad");
          return;
        }
        const nome = elements.postoNomeInput.value.trim();
        if (!nome) {
          setMessage(elements.postoMsgAdmin, "Informe o nome do posto.", "bad");
          return;
        }
        const cnpj = elements.postoCnpjInput.value.trim();
        const cidade = elements.postoCidadeInput?.value.trim() || "";
        if (!cidade) {
          setMessage(elements.postoMsgAdmin, "Informe a cidade/UF do posto para manter a rede organizada.", "bad");
          return;
        }
        const localizacao = elements.postoLocalizacaoInput.value.trim();
        const coords = getCoordinatesFromLocalizacao(localizacao);
        const loginEmail = elements.postoLoginEmail ? elements.postoLoginEmail.value.trim() : "";
        const loginSenha = elements.postoLoginSenha ? elements.postoLoginSenha.value.trim() : "";
        if ((loginEmail && !loginSenha) || (!loginEmail && loginSenha)) {
          setMessage(elements.postoMsgAdmin, "Informe email e senha para criar o acesso do posto.", "bad");
          return;
        }
        if (loginSenha) {
          const senhaRuleError = accessPasswordRuleError(loginSenha);
          if (senhaRuleError) {
            setMessage(elements.postoMsgAdmin, senhaRuleError, "bad");
            return;
          }
        }
        if (loginEmail && getUsuarioByEmailInsensitive(loginEmail)) {
          setMessage(elements.postoMsgAdmin, "Email ja cadastrado para outro acesso.", "bad");
          return;
        }
        if (!DEMO_MODE && window.location.protocol !== "file:") {
          const remoteCreate = await createPostoOnServer({
            codigoMaquininha: codigo,
            codigoAcesso: acesso,
            nome,
            cnpj,
            cidade,
            localizacao,
            lat: coords?.lat,
            lng: coords?.lng,
            loginEmail,
            loginSenha,
          });
          if (!remoteCreate.ok) {
            const map = {
              email_in_use: "Email ja cadastrado para outro acesso.",
              invalid_nome: "Informe o nome do posto.",
              invalid_codigo_maquininha: "Informe o codigo da maquininha.",
              invalid_codigo_acesso: "Informe o codigo de acesso da maquininha.",
              duplicate_codigo_maquininha: "Codigo de maquininha ja cadastrado.",
              invalid_login_pair: "Informe email e senha para criar o acesso do posto.",
              db_write_failed: "Falha ao salvar no banco de dados.",
              db_encode_failed: "Falha ao preparar os dados para salvar no banco.",
              network_error: "Falha de conexao ao salvar no banco.",
            };
            setMessage(
              elements.postoMsgAdmin,
              map[remoteCreate.error] || `Falha ao salvar no banco (${remoteCreate.error || "erro_desconhecido"}).`,
              "bad"
            );
            return;
          }
          if (remoteCreate.data) {
            applyStateSnapshot(remoteCreate.data);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteCreate.data));
            } catch (error) {
            }
          }
          elements.postoCodigoInput.value = "";
          elements.postoAcessoInput.value = "";
          elements.postoNomeInput.value = "";
          elements.postoCnpjInput.value = "";
          if (elements.postoCidadeInput) elements.postoCidadeInput.value = "";
          elements.postoLocalizacaoInput.value = "";
          if (elements.postoLoginEmail) {
            elements.postoLoginEmail.value = "";
          }
          if (elements.postoLoginSenha) {
            elements.postoLoginSenha.value = "";
          }
          updatePostoPreviewLink();
          if (localizacao && !coords) {
            setMessage(
              elements.postoMsgAdmin,
              `Posto cadastrado. Codigo da maquininha: ${codigo}. Para rota e posto mais proximo, use link do Maps com coordenadas.`,
              "warn"
            );
          } else {
            setMessage(
              elements.postoMsgAdmin,
              remoteCreate.warning === "state_write_failed"
                ? `Posto cadastrado com sucesso. Codigo gerado: ${codigo} (fallback de persistencia aplicado).`
                : `Posto cadastrado com sucesso. Codigo da maquininha: ${codigo}`,
              "ok"
            );
          }
          logEvent("POSTO_CRIADO", nome);
          syncSelects();
          renderAdmin();
          renderReports();
          renderEmpresaDashboard();
          renderPostosList();
          return;
        }
        const posto = {
          id: generateId("P"),
          codigoMaquininha: codigo,
          codigoAcesso: acesso,
          nome,
          cnpj: cnpj || undefined,
          cidade,
          localizacao: localizacao || undefined,
          lat: coords?.lat,
          lng: coords?.lng,
        };
        state.postos.push(posto);
        state.empresas.forEach((empresa) => {
          if (!Array.isArray(empresa.postosConvenio)) return;
          if (!empresa.postosConvenio.includes(posto.id)) {
            empresa.postosConvenio.push(posto.id);
          }
        });
        if (loginEmail && loginSenha) {
          state.usuarios.push({
            id: generateId("U"),
            nome,
            email: loginEmail,
            senha: loginSenha,
            role: "posto",
            postoId: posto.id,
          });
        }
        const saved = await queueStateSave(true);
        elements.postoCodigoInput.value = "";
        elements.postoAcessoInput.value = "";
        elements.postoNomeInput.value = "";
        elements.postoCnpjInput.value = "";
        if (elements.postoCidadeInput) elements.postoCidadeInput.value = "";
        elements.postoLocalizacaoInput.value = "";
        if (elements.postoLoginEmail) {
          elements.postoLoginEmail.value = "";
        }
        if (elements.postoLoginSenha) {
          elements.postoLoginSenha.value = "";
        }
        updatePostoPreviewLink();
        if (!saved) {
          setMessage(
            elements.postoMsgAdmin,
            `Posto adicionado localmente com codigo ${codigo}, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
            "warn"
          );
        } else if (localizacao && !coords) {
          setMessage(
            elements.postoMsgAdmin,
            `Posto cadastrado. Codigo da maquininha: ${codigo}. Para rota e posto mais proximo, use link do Maps com coordenadas.`,
            "warn"
          );
        } else {
          setMessage(elements.postoMsgAdmin, `Posto cadastrado com sucesso. Codigo da maquininha: ${codigo}`, "ok");
        }
        logEvent("POSTO_CRIADO", nome);
        syncSelects();
        renderAdmin();
        renderReports();
        renderEmpresaDashboard();
        renderPostosList();
      }

      function handleFindNearestPosto() {
        elements.postoMapsLink.classList.add("hidden");
        elements.postoMapsLink.removeAttribute("href");
        setMessage(elements.postoNearestMsg, "", "muted");
        setNearestStatus("Buscando localizacao...", "warn");

        if (!getScopedPostos().length) {
          setNearestStatus("Sem postos conveniados", "bad");
          setMessage(elements.postoNearestMsg, "Nenhum posto conveniado para esta empresa.", "warn");
          renderPostosList();
          return;
        }

        if (!navigator.geolocation) {
          setNearestStatus("Geolocalizacao indisponivel", "bad");
          setMessage(elements.postoNearestMsg, "Seu navegador nao suporta geolocalizacao.", "bad");
          renderPostosList();
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            lastKnownLocation = { lat: latitude, lng: longitude, accuracy: position.coords?.accuracy };
            const result = findNearestPosto(latitude, longitude);
            if (!result) {
              setNearestStatus("Sem postos com coordenadas", "bad");
              setMessage(
                elements.postoNearestMsg,
                "Cadastre um link do Maps com coordenadas para calcular o mais proximo.",
                "bad"
              );
              renderPostosList();
              return;
            }
            const { posto, distanceKm } = result;
            elements.postoNearestName.textContent = posto.nome;
            const details = [];
            if (posto.cnpj) {
              details.push(`CNPJ: ${posto.cnpj}`);
            }
            const localizacao = formatPostoLocalizacao(posto);
            if (localizacao !== "--") {
              details.push(`Localizacao: ${localizacao}`);
            }
            details.push(`Distancia: ${formatDistanceKm(distanceKm)}`);
            elements.postoNearestDetails.textContent = details.join(" | ");
            setNearestStatus("Mais proximo", "ok");
            const mapsUrl = buildMapsUrl(posto, lastKnownLocation);
            if (mapsUrl) {
              elements.postoMapsLink.href = mapsUrl;
              elements.postoMapsLink.classList.remove("hidden");
            }
            setMessage(elements.postoNearestMsg, "Rota pronta para abrir no Maps.", "ok");
            renderPostosList();
          },
          (error) => {
            let reason = "Nao foi possivel obter sua localizacao.";
            if (error && error.code === 1) {
              reason = "Permissao de localizacao negada.";
            } else if (error && error.code === 3) {
              reason = "Tempo esgotado para obter localizacao.";
            }
            setNearestStatus("Falha na localizacao", "bad");
            setMessage(elements.postoNearestMsg, reason, "bad");
            renderPostosList();
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      }

      function renderPostosList() {
        elements.postoList.innerHTML = "";
        const postosBase = getScopedPostos();
        if (!postosBase.length) {
          const hasPostos = state.postos.length > 0;
          setMessage(
            elements.postoListMsg,
            hasPostos ? "Nenhum posto conveniado para esta empresa." : "Nenhum posto cadastrado.",
            "muted"
          );
          return;
        }
        setMessage(elements.postoListMsg, "", "muted");
        const origin = lastKnownLocation;
        const entries = postosBase.map((posto) => {
          const coords = resolvePostoCoords(posto);
          const distanceKm =
            origin && coords ? haversineDistance(origin.lat, origin.lng, coords.lat, coords.lng) : null;
          return { posto, distanceKm };
        });
        if (origin) {
          entries.sort((a, b) => {
            if (a.distanceKm === null && b.distanceKm === null) return 0;
            if (a.distanceKm === null) return 1;
            if (b.distanceKm === null) return -1;
            return a.distanceKm - b.distanceKm;
          });
        }
        const nearestEntry = entries.find((entry) => entry.distanceKm !== null) || null;
        const cityGroups = new Map();
        entries.forEach((entry) => {
          const cidade = getPostoCidade(entry.posto);
          if (!cityGroups.has(cidade)) cityGroups.set(cidade, []);
          cityGroups.get(cidade).push(entry);
        });
        const groupedEntries = Array.from(cityGroups.entries()).map(([cidade, cityEntries]) => ({
          cidade,
          entries: cityEntries,
          minDistance: Math.min(...cityEntries.map((item) => item.distanceKm === null ? Number.POSITIVE_INFINITY : item.distanceKm)),
        }));
        groupedEntries.sort((a, b) => {
          if (origin && a.minDistance !== b.minDistance) return a.minDistance - b.minDistance;
          return a.cidade.localeCompare(b.cidade, "pt-BR");
        });
        groupedEntries.forEach((groupData, groupIndex) => {
          const group = document.createElement("details");
          group.className = "posto-city-group";
          group.open = groupIndex === 0;
          const summary = document.createElement("summary");
          summary.innerHTML = `<span>${escapeHtml(groupData.cidade)}</span><span class="posto-city-group-count">${groupData.entries.length}</span>`;
          const body = document.createElement("div");
          body.className = "posto-city-group-body";
          groupData.entries
            .slice()
            .sort((a, b) => {
              if (origin) {
                const da = a.distanceKm === null ? Number.POSITIVE_INFINITY : a.distanceKm;
                const db = b.distanceKm === null ? Number.POSITIVE_INFINITY : b.distanceKm;
                if (da !== db) return da - db;
              }
              return String(a.posto.nome || "").localeCompare(String(b.posto.nome || ""), "pt-BR");
            })
            .forEach((entry) => {
              const { posto, distanceKm } = entry;
              const item = document.createElement("div");
              item.className = "list-item";
              const badges = [];
              if (nearestEntry && nearestEntry.posto.id === posto.id) {
                badges.push('<span class="pill">Mais próximo</span>');
              }
              const meta = [];
              if (posto.codigoMaquininha) meta.push(`Código: ${posto.codigoMaquininha}`);
              if (posto.cnpj) meta.push(`CNPJ: ${posto.cnpj}`);
              const local = formatPostoLocalizacao(posto);
              if (local !== "--") meta.push(`Localização: ${local}`);
              if (origin && distanceKm !== null) meta.push(`Distância: ${formatDistanceKm(distanceKm)}`);
              const mapsUrl = buildMapsUrl(posto, origin);
              const mapsText = mapsLabel("Maps");
              item.innerHTML = `
                <div>
                  <div>${escapeHtml(posto.nome || "--")} ${badges.join(" ")}</div>
                  <div class="muted">${meta.map((value) => escapeHtml(value)).join(" | ") || "Sem detalhes"}</div>
                </div>
                <a class="chip maps-link" data-posto-id="${escapeHtml(posto.id || "")}" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">${mapsText}</a>
              `;
              body.appendChild(item);
            });
          group.append(summary, body);
          elements.postoList.appendChild(group);
        });
      }

      function handlePostoListRoute(event) {
        const link = event.target.closest("a[data-posto-id]");
        if (!link) return;
        const posto = getPosto(link.dataset.postoId);
        if (!posto) return;
        if (lastKnownLocation) {
          link.href = buildMapsUrl(posto, lastKnownLocation);
          return;
        }
        event.preventDefault();
        const popup = window.open("", "_blank", "noopener");
        if (!popup) {
          setMessage(elements.postoListMsg, "Permita pop-ups para abrir a rota.", "bad");
          return;
        }
        if (!navigator.geolocation) {
          setMessage(elements.postoListMsg, "Seu navegador nao suporta geolocalizacao.", "bad");
          popup.close();
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            lastKnownLocation = { lat: latitude, lng: longitude, accuracy: position.coords?.accuracy };
            const mapsUrl = buildMapsUrl(posto, lastKnownLocation);
            if (mapsUrl) {
              popup.location = mapsUrl;
              setMessage(elements.postoListMsg, "Rota pronta para abrir no Maps.", "ok");
              renderPostosList();
            }
          },
          (error) => {
            let reason = "Nao foi possivel obter sua localizacao.";
            if (error && error.code === 1) {
              reason = "Permissao de localizacao negada.";
            } else if (error && error.code === 3) {
              reason = "Tempo esgotado para obter localizacao.";
            }
            setMessage(elements.postoListMsg, reason, "bad");
            popup.close();
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      }

      async function handleConfigUpdate() {
        const validade = Number(elements.configValidade.value);
        if (!Number.isFinite(validade) || validade < 30) {
          setMessage(elements.configMsg, "Informe uma validade de QR maior ou igual a 30 segundos.", "bad");
          return;
        }
        state.validadeMs = Math.round(validade) * 1000;
        elements.configValidade.value = Math.floor(state.validadeMs / 1000);
        logEvent("CONFIG_ATUALIZADA", `QR ${state.validadeMs / 1000}s`);
        const saved = await queueStateSave(true);
        if (!saved) {
          setMessage(
            elements.configMsg,
            `Configuracoes atualizadas localmente, mas falhou ao salvar no banco (${lastStateSaveError || "erro_desconhecido"}).`,
            "warn"
          );
        } else {
          setMessage(elements.configMsg, "Configuracoes atualizadas.", "ok");
        }
        updateKpis();
        renderAdmin();
        renderEmpresaDashboard();
      }

      async function handleValidate() {
        const rawToken = elements.leitorToken.value.trim();
        const postoId = elements.leitorPosto.value;
        const combustivel = elements.leitorCombustivel ? elements.leitorCombustivel.value.trim() : "";
        if (!rawToken) {
          setMessage(elements.leitorMsg, "Cole o token para validar.", "bad");
          return;
        }
        if (!combustivel) {
          setMessage(elements.leitorMsg, "Selecione o tipo de combustivel.", "bad");
          return;
        }
        const result = await validateToken(rawToken, postoId);
        if (!result.ok) {
          setMessage(elements.leitorMsg, result.reason, "bad");
          updateResult(null, "bad", "NEGADO");
          return;
        }
        const tx = registrarTransacao(result.payload, rawToken, combustivel);
        updateResult(
          result.payload,
          "ok",
          "APROVADO - AGUARDANDO SENHA",
          combustivel,
          result.payload.payment_source
        );
        setMessage(elements.leitorMsg, `Transacao ${tx.id} aprovada. Aguarde confirmacao.`, "ok");
        if (state.currentToken && state.currentToken.token === rawToken) {
          state.currentToken.used = true;
          setTokenStatus("Usado", "warn");
          setMessage(elements.tokenMsg, "QR utilizado com sucesso.", "ok");
          if (state.timerId) {
            clearInterval(state.timerId);
            state.timerId = null;
          }
        }
        renderTransacoes();
        updateKpis();
        renderReports();
        renderAdmin();
        renderEmpresaDashboard();
        renderPostoDashboard();
        await queueStateSave(true);
        publishTxSignal(tx, "pendente");
        maybePromptPendingConfirmation();
      }

      function init() {
        const splash = document.getElementById("splash");
        setTimeout(() => {
          if (splash) {
            splash.classList.add("hidden");
          }
          document.body.classList.add("booted");
          document.body.classList.remove("booting");
        }, 900);
        const resetTokenParam = String(new URLSearchParams(window.location.search).get("reset_token") || "").trim();
        if (resetTokenParam) {
          clearSession();
        }
        const restored = resetTokenParam ? false : restoreSession();
        if (!restored) {
          elements.portal.classList.add("hidden");
          elements.authScreen.classList.remove("hidden");
          const roleParam = new URLSearchParams(window.location.search).get("role");
          const lockedPanel = resetTokenParam ? "colaborador" : roleParam ? AUTH_PANEL_BY_ROLE[roleParam] : null;
          if (lockedPanel === "maquininha") {
            window.location.replace("../maquininha.html");
            return;
          }
          if (lockedPanel && !resetTokenParam) {
            document.body.classList.add("auth-locked");
          }
          setAuthPanel(lockedPanel || "corporativo");
          if (restoreExpiredSessionInfo && !resetTokenParam) {
            const expiredIsColab = restoreExpiredSessionInfo.type === "colaborador";
            if (expiredIsColab) {
              setAuthPanel("colaborador");
              if (elements.colabCpf && restoreExpiredSessionInfo.cpf) {
                elements.colabCpf.value = formatCpfInput(restoreExpiredSessionInfo.cpf);
              }
              updateColabMode();
              setColabMessage("Sessao expirada no mobile. Entre novamente.", "warn");
            } else {
              if (elements.loginEmail && restoreExpiredSessionInfo.email) {
                elements.loginEmail.value = restoreExpiredSessionInfo.email;
              }
              setAuthMessage("Sessao expirada no mobile. Entre novamente.", "warn");
            }
            restoreExpiredSessionInfo = null;
          }
          if (isLocalHost && DEMO_MODE && !resetTokenParam) {
            setAuthMessage(
              `Admin: ${LOCAL_TEST_FIXTURES.adminUser.email} / ${LOCAL_TEST_FIXTURES.adminUser.senha} | Empresa: ${LOCAL_TEST_FIXTURES.empresaUser.email} / ${LOCAL_TEST_FIXTURES.empresaUser.senha} | Posto: ${LOCAL_TEST_FIXTURES.postoUser.email} / ${LOCAL_TEST_FIXTURES.postoUser.senha}`,
              "ok"
            );
            elements.loginEmail.value = LOCAL_TEST_FIXTURES.adminUser.email;
            elements.loginPassword.value = LOCAL_TEST_FIXTURES.adminUser.senha;
            if (elements.colabCpf) {
              elements.colabCpf.value = LOCAL_TEST_FIXTURES.funcionario.cpf;
            }
            if (elements.colabSenha) {
              elements.colabSenha.value = LOCAL_TEST_FIXTURES.colaboradorAuth.senha;
            }
            setColabMessage(
              `Colaborador: CPF ${LOCAL_TEST_FIXTURES.funcionario.cpf} | senha ${LOCAL_TEST_FIXTURES.colaboradorAuth.senha}`,
              "ok"
            );
            if (elements.maquininhaCodigo) {
              elements.maquininhaCodigo.value = LOCAL_TEST_FIXTURES.posto.codigoMaquininha;
              updateMaquininhaPreview(elements.maquininhaCodigo.value);
            }
            if (elements.maquininhaPin) {
              elements.maquininhaPin.value = LOCAL_TEST_FIXTURES.posto.codigoAcesso;
            }
            if (elements.maquininhaMessage) {
              setMessage(
                elements.maquininhaMessage,
                `Maquininha: ${LOCAL_TEST_FIXTURES.posto.codigoMaquininha} / ${LOCAL_TEST_FIXTURES.posto.codigoAcesso}`,
                "ok"
              );
            }
          }
          if ((!lockedPanel || resetTokenParam) && elements.authTabs && elements.authTabs.forEach) {
            elements.authTabs.forEach((tab) => {
              tab.addEventListener("click", () => {
                setAuthPanel(tab.dataset.auth);
              });
            });
          }
        }
        setupInputMasks();
        elements.loginForm.addEventListener("submit", handleLogin);
        elements.colabForm.addEventListener("submit", handleColabSubmit);
        if (elements.maquininhaForm) {
          elements.maquininhaForm.addEventListener("submit", handleMaquininhaLogin);
        }
        if (elements.maquininhaCodigo) {
          elements.maquininhaCodigo.addEventListener("input", () => {
            updateMaquininhaPreview(elements.maquininhaCodigo.value);
          });
        }
        if (elements.txConfirmClose) {
          elements.txConfirmClose.addEventListener("click", () => closeConfirmModal(true));
        }
        if (elements.txConfirmLater) {
          elements.txConfirmLater.addEventListener("click", handleConfirmReject);
        }
        if (elements.txConfirmBackdrop) {
          elements.txConfirmBackdrop.addEventListener("click", () => closeConfirmModal(true));
        }
        if (elements.txConfirmSubmit) {
          elements.txConfirmSubmit.addEventListener("click", handleConfirmSubmit);
        }
        if (elements.termsAccept) {
          elements.termsAccept.addEventListener("click", handleTermsAccept);
        }
        if (elements.termsDecline) {
          elements.termsDecline.addEventListener("click", handleTermsDecline);
        }
        if (elements.txConfirmPassword) {
          elements.txConfirmPassword.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleConfirmSubmit();
            }
          });
        }
        if (elements.txRevealAccess) {
          elements.txRevealAccess.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleTxRevealAccess();
            }
          });
        }
        if (elements.colabCpf) {
          elements.colabCpf.addEventListener("input", () => {
            updateColabMode();
            if (colabState.mode === "register") saveColabRegisterDraft();
          });
        }
        if (elements.colabEmail) {
          elements.colabEmail.addEventListener("input", () => {
            resetColabEmailCodeState();
          });
        }
        if (elements.colabEmailSendCode) {
          elements.colabEmailSendCode.addEventListener("click", handleColabSendEmailCode);
        }
        if (elements.colabFotoInput) {
          elements.colabFotoInput.addEventListener("click", saveColabRegisterDraft);
          elements.colabFotoInput.addEventListener("change", handleColabPhotoChange);
        }
        if (elements.colabCameraOpen) {
          elements.colabCameraOpen.addEventListener("click", openColabCameraModal);
        }
        if (elements.colabCameraClose) {
          elements.colabCameraClose.addEventListener("click", closeColabCameraModal);
        }
        if (elements.colabCameraBackdrop) {
          elements.colabCameraBackdrop.addEventListener("click", closeColabCameraModal);
        }
        if (elements.colabCameraCapture) {
          elements.colabCameraCapture.addEventListener("click", captureColabCameraPhoto);
        }
        if (elements.colabCameraSwitch) {
          elements.colabCameraSwitch.addEventListener("click", switchColabCamera);
        }
        [
          elements.colabSenha,
          elements.colabSenhaConfirm,
          elements.colabTxPin,
          elements.colabTxPinConfirm,
          elements.colabEmail,
          elements.colabTelefone,
          elements.colabEmailCode,
        ].filter(Boolean).forEach((input) => {
          input.addEventListener("input", () => {
            if (colabState.mode === "register") saveColabRegisterDraft();
          });
        });
        if (elements.profileFotoInput) {
          elements.profileFotoInput.addEventListener("change", handleProfilePhotoUpload);
        }
        if (elements.colabBioLogin) {
          elements.colabBioLogin.addEventListener("click", handleBiometricLogin);
        }
        if (elements.colabBioToggleLogin) {
          elements.colabBioToggleLogin.addEventListener("click", handleColabBiometricToggleLogin);
        }
        if (elements.colabBioAutoCheck) {
          elements.colabBioAutoCheck.addEventListener("change", handleColabBiometricAutoLoginChange);
        }
        if (elements.colabForgot) {
          elements.colabForgot.addEventListener("click", openColabForgotModal);
        }
        if (elements.colabForgotClose) {
          elements.colabForgotClose.addEventListener("click", closeColabForgotModal);
        }
        if (elements.colabForgotCpf) {
          elements.colabForgotCpf.addEventListener("input", updateColabForgotContactPreview);
        }
        if (elements.colabForgotSendCode) {
          elements.colabForgotSendCode.addEventListener("click", handleColabForgotSendCode);
        }
        if (elements.colabForgotBackdrop) {
          elements.colabForgotBackdrop.addEventListener("click", closeColabForgotModal);
        }
        if (elements.colabResetClose) {
          elements.colabResetClose.addEventListener("click", () => closeColabResetModal(true));
        }
        if (elements.colabResetCancel) {
          elements.colabResetCancel.addEventListener("click", () => closeColabResetModal(true));
        }
        if (elements.colabResetOk) {
          elements.colabResetOk.addEventListener("click", handleColabResetSubmit);
        }
        if (elements.colabResetBackdrop) {
          elements.colabResetBackdrop.addEventListener("click", () => closeColabResetModal(true));
        }
        if (elements.balanceVisibilityToggle) {
          elements.balanceVisibilityToggle.addEventListener("change", handleBalanceVisibilityToggle);
        }
        if (elements.bioToggle) {
          elements.bioToggle.addEventListener("change", handleBiometriaToggle);
        }
        if (elements.notifyToggle) {
          elements.notifyToggle.addEventListener("change", handleNotifyToggle);
        }
        if (elements.settingsGear) {
          elements.settingsGear.addEventListener("click", () => activateTab("configuracoes"));
        }
        if (elements.configBtn) {
          elements.configBtn.addEventListener("click", handleConfigUpdate);
        }
        elements.logoutBtn.addEventListener("click", handleLogout);
        if (elements.passwordEmailSend) {
          elements.passwordEmailSend.addEventListener("click", handlePasswordEmailResetRequest);
        }
        if (elements.txPinForm) {
          elements.txPinForm.addEventListener("submit", handleTxPinUpdate);
        }
        if (elements.txPinSendCode) {
          elements.txPinSendCode.addEventListener("click", handleTxPinSendCode);
        }
        document.querySelectorAll(".balance-toggle").forEach((button) => {
          button.addEventListener("click", toggleBalanceVisibility);
        });
        setupBrandLogo();
        setupTabs();
        setupPasswordToggles();
        setupBankActions();
        setupAdminTabs();
        setupEmpresaTabs();
        hydrateColabCpfForAutoBiometric();
        updateColabMode();
        restoreColabRegisterDraft();
        syncColabBiometricAutoLoginControl();
        setupTxBroadcast();
        initModalScrollLock();
        syncBiometriaToggle();
        syncColaboradorSettings();
        if (!restored && !resetTokenParam) {
          applyRoleHint();
        }
        if (resetTokenParam) {
          handleResetTokenFromUrl();
        }
        syncSelects();
        if (elements.empresaFilterApply) {
          elements.empresaFilterApply.addEventListener("click", renderEmpresaDashboard);
        }
        if (elements.empresaLimiteTipo) {
          elements.empresaLimiteTipo.addEventListener("change", () => {
            const fixo = elements.empresaLimiteTipo.value === "fixo";
            elements.empresaLimiteFixoWrap?.classList.toggle("hidden", !fixo);
            if (!fixo && elements.empresaLimiteResumo) {
              elements.empresaLimiteResumo.textContent = "Regra selecionada: 30% do salario, com maximo de R$ 890,00 por colaborador.";
            }
          });
        }
        if (elements.empresaLimiteSave) {
          elements.empresaLimiteSave.addEventListener("click", handleEmpresaLimiteSave);
        }
        if (elements.empresaLimiteTipoAdmin) {
          elements.empresaLimiteTipoAdmin.addEventListener("change", () => {
            elements.empresaLimiteFixoAdminWrap?.classList.toggle("hidden", elements.empresaLimiteTipoAdmin.value !== "fixo");
          });
        }
        if (elements.empresaModalLimiteTipo) {
          elements.empresaModalLimiteTipo.addEventListener("change", () => {
            elements.empresaModalLimiteFixoWrap?.classList.toggle("hidden", elements.empresaModalLimiteTipo.value !== "fixo");
          });
        }
        if (elements.empresaConvenioSave) {
          elements.empresaConvenioSave.addEventListener("click", handleEmpresaConvenioSave);
        }
        if (elements.empresaSelfSave) {
          elements.empresaSelfSave.addEventListener("click", handleEmpresaSelfSave);
        }
        elements.empresaSelect.addEventListener("change", () => {
          updateFuncionarioOptions();
          renderReports();
          updateHeaderBrand();
        });
        elements.funcionarioSelect.addEventListener("change", () => {
          updateKpis();
          renderReports();
        });
        if (elements.valorInput) {
          elements.valorInput.addEventListener("input", handleValorInput);
        }
        elements.relatorioFuncionario.addEventListener("change", renderReports);
        elements.relatorioEmpresaSelect.addEventListener("change", renderReports);
        if (elements.relatorioFolhaEmpresa) {
          elements.relatorioFolhaEmpresa.addEventListener("change", () => {
            if (elements.relatorioEmpresaSelect) {
              elements.relatorioEmpresaSelect.value = elements.relatorioFolhaEmpresa.value;
            }
            renderReports();
          });
        }
        elements.relatorioPostoSelect.addEventListener("change", renderReports);
        if (elements.relatorioEmpresaPosto) {
          elements.relatorioEmpresaPosto.addEventListener("change", renderReports);
        }
        if (elements.reportApplyBtn) {
          elements.reportApplyBtn.addEventListener("click", renderReports);
        }
        elements.gerarToken.addEventListener("click", generateToken);
        elements.clearToken.addEventListener("click", clearToken);
        elements.copyToken.addEventListener("click", () => {
          if (!elements.tokenValue.value) return;
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(elements.tokenValue.value);
            setMessage(elements.tokenMsg, "Token copiado.", "ok");
          } else {
            elements.tokenValue.select();
            document.execCommand("copy");
            setMessage(elements.tokenMsg, "Token copiado.", "ok");
          }
        });
        elements.simularLeitura.addEventListener("click", () => {
          if (!state.currentToken) {
            setMessage(elements.leitorMsg, "Nenhum QR ativo no app.", "bad");
            return;
          }
          elements.leitorToken.value = state.currentToken.token;
          setMessage(elements.leitorMsg, "Token preenchido.", "ok");
        });
        elements.validarToken.addEventListener("click", handleValidate);
        if (elements.scannerStart) {
          elements.scannerStart.addEventListener("click", startScanner);
        }
        if (elements.scannerStop) {
          elements.scannerStop.addEventListener("click", stopScanner);
        }
        if (elements.scannerFile) {
          elements.scannerFile.addEventListener("change", handleScannerFile);
        }
        elements.reportExportBtn.addEventListener("click", handleReportExport);
        if (elements.resetMonth) {
          elements.resetMonth.addEventListener("click", () => {
            state.transacoes = [];
            state.usedTokens.clear();
            clearToken();
            renderTransacoes();
            renderReports();
            renderAdmin();
            updateKpis();
            logEvent("MES_FECHADO", "Transacoes zeradas para novo periodo.");
            setMessage(elements.leitorMsg, "Mes resetado para novo fechamento.", "ok");
          });
        }
        elements.empresaAdd.addEventListener("click", handleEmpresaAdd);
        elements.funcAdd.addEventListener("click", handleFuncionarioAdd);
        elements.postoAdd.addEventListener("click", handlePostoAdd);
        elements.postoCaptureBtn.addEventListener("click", handlePostoCapture);
        elements.postoLocalizacaoInput.addEventListener("input", updatePostoPreviewLink);
        elements.postoNearestBtn.addEventListener("click", handleFindNearestPosto);
        elements.postoList.addEventListener("click", handlePostoListRoute);
        elements.empresaAdminList.addEventListener("click", handleEmpresaAdminListAction);
        elements.funcAdminTable.addEventListener("click", handleFuncionarioAdminTableAction);
        if (elements.funcAdminSearch) {
          elements.funcAdminSearch.addEventListener("input", renderAdminCadastros);
        }
        if (elements.funcAdminEmpresaFilter) {
          elements.funcAdminEmpresaFilter.addEventListener("change", renderAdminCadastros);
        }
        if (elements.funcAdminStatusFilter) {
          elements.funcAdminStatusFilter.addEventListener("change", renderAdminCadastros);
        }
        elements.postoAdminList.addEventListener("click", handlePostoAdminListAction);
        elements.empresaFuncAdd.addEventListener("click", handleEmpresaFuncionarioAdd);
        elements.empresaFuncSearch.addEventListener("input", () => { empresaFuncPage = 1; renderEmpresaFuncionariosList(); });
        if (elements.empresaFuncContratoFilter) {
          elements.empresaFuncContratoFilter.addEventListener("change", () => { empresaFuncPage = 1; renderEmpresaFuncionariosList(); });
        }
        if (elements.empresaFuncLocalidadeFilter) {
          elements.empresaFuncLocalidadeFilter.addEventListener("change", () => { empresaFuncPage = 1; renderEmpresaFuncionariosList(); });
        }
        if (elements.empresaFuncSort) {
          elements.empresaFuncSort.addEventListener("change", () => { empresaFuncPage = 1; renderEmpresaFuncionariosList(); });
        }
        if (elements.empresaFuncPageSize) {
          elements.empresaFuncPageSize.addEventListener("change", () => { empresaFuncPage = 1; renderEmpresaFuncionariosList(); });
        }
        if (elements.empresaFuncPrev) {
          elements.empresaFuncPrev.addEventListener("click", () => { empresaFuncPage = Math.max(1, empresaFuncPage - 1); renderEmpresaFuncionariosList(); });
        }
        if (elements.empresaFuncNext) {
          elements.empresaFuncNext.addEventListener("click", () => { empresaFuncPage += 1; renderEmpresaFuncionariosList(); });
        }
        if (elements.empresaOrgTableBody) {
          elements.empresaOrgTableBody.addEventListener("click", (event) => {
            const row = event.target.closest("tr[data-contrato]");
            if (!row) return;
            if (elements.empresaFuncContratoFilter) elements.empresaFuncContratoFilter.value = row.dataset.contrato || "";
            if (elements.empresaFuncLocalidadeFilter) elements.empresaFuncLocalidadeFilter.value = row.dataset.localidade || "";
            empresaFuncPage = 1;
            renderEmpresaFuncionariosList();
            elements.empresaFuncList?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
        elements.empresaFuncList.addEventListener("click", handleEmpresaFuncionarioListAction);
        elements.empresaLogoInput.addEventListener("change", handleEmpresaLogoUpload);
        elements.empresaLogoRemove.addEventListener("click", handleEmpresaLogoRemove);
        elements.empresaModalClose.addEventListener("click", closeEmpresaModal);
        elements.empresaModalSave.addEventListener("click", handleEmpresaModalSave);
        elements.empresaModal.addEventListener("click", (event) => {
          if (event.target === elements.empresaModal) {
            closeEmpresaModal();
          }
        });
        elements.funcModalClose.addEventListener("click", closeFuncionarioModal);
        elements.funcModalSave.addEventListener("click", handleFuncionarioModalSave);
        elements.funcModal.addEventListener("click", (event) => {
          if (event.target === elements.funcModal) {
            closeFuncionarioModal();
          }
        });
        if (elements.empresaFuncProfileClose) {
          elements.empresaFuncProfileClose.addEventListener("click", closeEmpresaFuncionarioProfile);
        }
        if (elements.empresaFuncProfileBackdrop) {
          elements.empresaFuncProfileBackdrop.addEventListener("click", closeEmpresaFuncionarioProfile);
        }
        if (elements.empresaFuncProfileModal) {
          elements.empresaFuncProfileModal.addEventListener("click", (event) => {
            if (event.target === elements.empresaFuncProfileModal) {
              closeEmpresaFuncionarioProfile();
            }
          });
        }
        elements.postoModalClose.addEventListener("click", closePostoModal);
        elements.postoModalSave.addEventListener("click", handlePostoModalSave);
        elements.postoModalLogoInput.addEventListener("change", handlePostoLogoUpload);
        elements.postoModalLogoRemove.addEventListener("click", handlePostoLogoRemove);
        elements.postoModal.addEventListener("click", (event) => {
          if (event.target === elements.postoModal) {
            closePostoModal();
          }
        });
        elements.adminFilterEmpresa.addEventListener("change", renderAdminTransacoes);
        elements.adminFilterPosto.addEventListener("change", renderAdminTransacoes);
        elements.postoMapsLink.innerHTML = mapsOpenLabel;
        elements.postoPreviewLink.innerHTML = mapsOpenLabel;
        updatePostoPreviewLink();
        if (elements.postoEmpresaFilter) {
          elements.postoEmpresaFilter.addEventListener("change", renderPostoDashboard);
        }
        if (elements.postoFilterApply) {
          elements.postoFilterApply.addEventListener("click", renderPostoDashboard);
        }
        renderEmpresaDashboard();
        renderPostoDashboard();
        renderPostosList();
      }

      async function resolvePrintImageDataUrl(src) {
        const raw = String(src || "").trim();
        if (!raw) return "";
        if (raw.startsWith("data:image/")) return raw;
        try {
          const response = await fetch(raw, { cache: "no-store", credentials: "same-origin" });
          if (!response.ok) return raw;
          const blob = await response.blob();
          return await blobToBase64Payload(blob).then((payload) => payload ? `data:${blob.type || "image/png"};base64,${payload}` : raw);
        } catch (error) {
          return raw;
        }
      }

      async function waitForPrintImages(win) {
        const images = Array.from(win.document.images || []);
        await Promise.all(images.map((img) => new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, 2500);
        })));
        if (win.document.fonts?.ready) {
          try { await win.document.fonts.ready; } catch (error) {}
        }
        await new Promise((resolve) => setTimeout(resolve, 120));
      }

      async function printReport(reportId, title) {
        const source = document.getElementById(reportId);
        const reportClone = source ? source.cloneNode(true) : null;
        if (!reportClone) return;
        const win = window.open("", "_blank");
        if (!win) return;
        reportClone.querySelectorAll("select, input").forEach((field) => {
          const span = document.createElement("span");
          span.className = "print-select";
          if (field.tagName === "SELECT") {
            span.textContent = field.options[field.selectedIndex]?.textContent || "--";
          } else {
            span.textContent = field.value || "--";
          }
          field.replaceWith(span);
        });
        const logoNodes = Array.from(reportClone.querySelectorAll("img"));
        await Promise.all(logoNodes.map(async (img) => {
          const current = img.getAttribute("src") || img.src || "";
          if (!current) return;
          const stable = await resolvePrintImageDataUrl(current);
          if (stable) img.setAttribute("src", stable);
        }));
        const content = reportClone.outerHTML;
        const periodo = state.reportData.periodo || "--";
        const geradoEm = new Date().toLocaleString("pt-BR");
        const appLogoUrl = await resolvePrintImageDataUrl(new URL("../assets/Logo.png", window.location.href).href);
        win.document.write(`
          <html>
            <head>
              <title>${escapeHtml(title)}</title>
              <link rel="preconnect" href="https://fonts.googleapis.com" />
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
              <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600&family=Space+Grotesk:wght@400;500&display=swap" rel="stylesheet" />
              <style>
                @page { margin: 18mm; }
                body { font-family: "Space Grotesk", "Sora", Arial, sans-serif; padding: 0; color: #111827; background: #f8faf7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
                .muted { color: #5f6b7b; }
                .print-page { display: grid; gap: 22px; }
                .print-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; background: linear-gradient(135deg, #e8f7f0 0%, #d7f0e4 70%, #f6fbf7 100%); color: #0b6b4a; padding: 18px 20px; border: 2px solid #1aa06d; border-radius: 18px; }
                .print-brand { display: flex; align-items: center; gap: 14px; }
                .print-logo { width: 78px; height: 78px; object-fit: contain; border: none; padding: 0; background: transparent; }
                .brand-name { font-weight: 700; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #0b6b4a; }
                .brand-title { font-size: 22px; font-weight: 700; margin: 4px 0 0; color: #0b6b4a; }
                .brand-meta { color: #3d6b58; font-size: 12px; }
                .report-box { border: 1px solid #cfe7dc; border-left: 4px solid #1aa06d; border-radius: 16px; padding: 16px; background: #fff; box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08); }
                .report-brand { display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 1px solid #d6efe3; background: #f0fbf5; padding: 10px 12px; border-radius: 12px; margin-bottom: 12px; }
                .report-brand-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
                .report-brand-name { font-weight: 700; font-size: 14px; color: #0b6b4a; }
                .report-logo { width: 64px; height: 64px; object-fit: contain; border: none; padding: 0; background: #fff; border-radius: 8px; }
                .report-logo.hidden, .hidden { display: none !important; }
                .report-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 8px; }
                .report-total { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: #f0fbf5; border: 1px solid #cfe7dc; font-weight: 700; color: #0b6b4a; }
                .table-brand { display: inline-flex; align-items: center; gap: 8px; }
                .table-logo { width: 28px; height: 28px; object-fit: contain; border: none; padding: 0; background: #fff; }
                .print-select { display: inline-block; padding: 4px 8px; border-radius: 999px; border: 1px solid #1aa06d; color: #0b6b4a; font-weight: 600; }
                h2, h3 { color: #0b6b4a; }
                .report-header strong { color: #0b6b4a; }
                .table-scroll { overflow: visible !important; max-height: none !important; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; page-break-inside: auto; }
                thead { display: table-header-group; }
                tr { page-break-inside: avoid; page-break-after: auto; }
                th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid #e2ece6; vertical-align: middle; }
                tbody tr:nth-child(even) { background: #f7fdf9; }
                th { text-transform: uppercase; font-size: 10px; letter-spacing: 0.6px; color: #0b6b4a; background: #e6f5ee; }
              </style>
            </head>
            <body>
              <div class="print-page">
                <div class="print-header">
                  <div class="print-brand">
                    <img class="print-logo" src="${appLogoUrl}" alt="${escapeHtml(APP_NAME)}" />
                    <div>
                      <div class="brand-name">${escapeHtml(APP_NAME)}</div>
                      <div class="brand-title">${escapeHtml(title)}</div>
                      <div class="brand-meta">Periodo: ${escapeHtml(periodo)}</div>
                    </div>
                  </div>
                  <div class="brand-meta">Gerado em: ${escapeHtml(geradoEm)}</div>
                </div>
                ${content}
              </div>
            </body>
          </html>
        `);
        win.document.close();
        await waitForPrintImages(win);
        win.focus();
        win.print();
      }

      const APP_BUILD_VERSION = "2026-08-18.2";
      function forceBuildRefreshIfNeeded() {
        try {
          const key = "credtank-build-version";
          const current = localStorage.getItem(key);
          if (current === APP_BUILD_VERSION) return;
          localStorage.setItem(key, APP_BUILD_VERSION);
          if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
            navigator.serviceWorker.getRegistrations().then((regs) => {
              regs.forEach((reg) => reg.update());
            });
          }
        } catch (error) {
        }
      }
      forceBuildRefreshIfNeeded();

      loadStateFromServer().finally(() => {
        init();
        startAutoSave();
        startRealtimeSync();
      });
      if ("serviceWorker" in navigator && !IS_ANDROID_WEBVIEW_APP) {
        window.addEventListener("load", async () => {
          let refreshing = false;
          let pendingDesktopReload = false;
          const isDesktopLike = () => {
            if (!window.matchMedia) return false;
            if (MOBILE_UA) return false;
            return (
              window.matchMedia("(min-width: 1024px)").matches ||
              window.matchMedia("(pointer: fine)").matches
            );
          };
          const reloadNow = () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          };
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (!isDesktopLike()) {
              // No celular, nao recarrega automaticamente durante uma troca
              // do service worker: isso evita perder cadastro ao usar a camera.
              return;
            }
            pendingDesktopReload = true;
            if (document.hidden) {
              reloadNow();
            }
          });
          document.addEventListener("visibilitychange", () => {
            if (!pendingDesktopReload || !document.hidden) return;
            reloadNow();
          });
          try {
            const registration = await navigator.serviceWorker.register(`../service-worker.js?v=${APP_BUILD_VERSION}`, {
              updateViaCache: "none",
            });
            await registration.update();
          } catch (error) {
          }
        });
      } else if ("serviceWorker" in navigator && IS_ANDROID_WEBVIEW_APP) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister());
        }).catch(() => {});
      }
    