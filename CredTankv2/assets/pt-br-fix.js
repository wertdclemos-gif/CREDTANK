/* PT-BR text normalizer for static and dynamic UI content. */
(function () {
  if (typeof window === "undefined" || window.__ptBrFixLoaded) return;
  window.__ptBrFixLoaded = true;

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);
  const ATTRS_TO_FIX = ["placeholder", "title", "aria-label", "aria-placeholder", "alt"];

  const REPLACEMENTS = [
    [/\bOla\b/g, "Ol\u00e1"],
    [/\bola\b/g, "ol\u00e1"],
    [/\bNao\b/g, "N\u00e3o"],
    [/\bnao\b/g, "n\u00e3o"],
    [/\bVoce\b/g, "Voc\u00ea"],
    [/\bvoce\b/g, "voc\u00ea"],
    [/\bCredito\b/g, "Cr\u00e9dito"],
    [/\bcredito\b/g, "cr\u00e9dito"],
    [/\bCreditos\b/g, "Cr\u00e9ditos"],
    [/\bcreditos\b/g, "cr\u00e9ditos"],
    [/\bCodigo\b/g, "C\u00f3digo"],
    [/\bcodigo\b/g, "c\u00f3digo"],
    [/\bCodigos\b/g, "C\u00f3digos"],
    [/\bcodigos\b/g, "c\u00f3digos"],
    [/\bConfiguracoes\b/g, "Configura\u00e7\u00f5es"],
    [/\bconfiguracoes\b/g, "configura\u00e7\u00f5es"],
    [/\bConfiguracao\b/g, "Configura\u00e7\u00e3o"],
    [/\bconfiguracao\b/g, "configura\u00e7\u00e3o"],
    [/\bRelatorios\b/g, "Relat\u00f3rios"],
    [/\brelatorios\b/g, "relat\u00f3rios"],
    [/\bRelatorio\b/g, "Relat\u00f3rio"],
    [/\brelatorio\b/g, "relat\u00f3rio"],
    [/\bTransacao\b/g, "Transa\u00e7\u00e3o"],
    [/\btransacao\b/g, "transa\u00e7\u00e3o"],
    [/\bTransacoes\b/g, "Transa\u00e7\u00f5es"],
    [/\btransacoes\b/g, "transa\u00e7\u00f5es"],
    [/\bAutenticacao\b/g, "Autentica\u00e7\u00e3o"],
    [/\bautenticacao\b/g, "autentica\u00e7\u00e3o"],
    [/\bSeguranca\b/g, "Seguran\u00e7a"],
    [/\bseguranca\b/g, "seguran\u00e7a"],
    [/\bDisponivel\b/g, "Dispon\u00edvel"],
    [/\bdisponivel\b/g, "dispon\u00edvel"],
    [/\bConexao\b/g, "Conex\u00e3o"],
    [/\bconexao\b/g, "conex\u00e3o"],
    [/\bOperacao\b/g, "Opera\u00e7\u00e3o"],
    [/\boperacao\b/g, "opera\u00e7\u00e3o"],
    [/\bOperacoes\b/g, "Opera\u00e7\u00f5es"],
    [/\boperacoes\b/g, "opera\u00e7\u00f5es"],
    [/\bConfirmacao\b/g, "Confirma\u00e7\u00e3o"],
    [/\bconfirmacao\b/g, "confirma\u00e7\u00e3o"],
    [/\bConfirmacoes\b/g, "Confirma\u00e7\u00f5es"],
    [/\bconfirmacoes\b/g, "confirma\u00e7\u00f5es"],
    [/\bValidacao\b/g, "Valida\u00e7\u00e3o"],
    [/\bvalidacao\b/g, "valida\u00e7\u00e3o"],
    [/\bVerificacao\b/g, "Verifica\u00e7\u00e3o"],
    [/\bverificacao\b/g, "verifica\u00e7\u00e3o"],
    [/\bVerificacoes\b/g, "Verifica\u00e7\u00f5es"],
    [/\bverificacoes\b/g, "verifica\u00e7\u00f5es"],
    [/\bRecuperacao\b/g, "Recupera\u00e7\u00e3o"],
    [/\brecuperacao\b/g, "recupera\u00e7\u00e3o"],
    [/\bRecuperacoes\b/g, "Recupera\u00e7\u00f5es"],
    [/\brecuperacoes\b/g, "recupera\u00e7\u00f5es"],
    [/\bAutorizacao\b/g, "Autoriza\u00e7\u00e3o"],
    [/\bautorizacao\b/g, "autoriza\u00e7\u00e3o"],
    [/\bAutorizacoes\b/g, "Autoriza\u00e7\u00f5es"],
    [/\bautorizacoes\b/g, "autoriza\u00e7\u00f5es"],
    [/\bAprovacao\b/g, "Aprova\u00e7\u00e3o"],
    [/\baprovacao\b/g, "aprova\u00e7\u00e3o"],
    [/\bInformacao\b/g, "Informa\u00e7\u00e3o"],
    [/\binformacao\b/g, "informa\u00e7\u00e3o"],
    [/\bInformacoes\b/g, "Informa\u00e7\u00f5es"],
    [/\binformacoes\b/g, "informa\u00e7\u00f5es"],
    [/\bOpcao\b/g, "Op\u00e7\u00e3o"],
    [/\bopcao\b/g, "op\u00e7\u00e3o"],
    [/\bOpcoes\b/g, "Op\u00e7\u00f5es"],
    [/\bopcoes\b/g, "op\u00e7\u00f5es"],
    [/\bVersao\b/g, "Vers\u00e3o"],
    [/\bversao\b/g, "vers\u00e3o"],
    [/\bVersoes\b/g, "Vers\u00f5es"],
    [/\bversoes\b/g, "vers\u00f5es"],
    [/\bFuncao\b/g, "Fun\u00e7\u00e3o"],
    [/\bfuncao\b/g, "fun\u00e7\u00e3o"],
    [/\bFuncoes\b/g, "Fun\u00e7\u00f5es"],
    [/\bfuncoes\b/g, "fun\u00e7\u00f5es"],
    [/\bPagina\b/g, "P\u00e1gina"],
    [/\bpagina\b/g, "p\u00e1gina"],
    [/\bPaginas\b/g, "P\u00e1ginas"],
    [/\bpaginas\b/g, "p\u00e1ginas"],
    [/\bCamera\b/g, "C\u00e2mera"],
    [/\bcamera\b/g, "c\u00e2mera"],
    [/\bHistorico\b/g, "Hist\u00f3rico"],
    [/\bhistorico\b/g, "hist\u00f3rico"],
    [/\bHistoricos\b/g, "Hist\u00f3ricos"],
    [/\bhistoricos\b/g, "hist\u00f3ricos"],
    [/\bUsuario\b/g, "Usu\u00e1rio"],
    [/\busuario\b/g, "usu\u00e1rio"],
    [/\bUsuarios\b/g, "Usu\u00e1rios"],
    [/\busuarios\b/g, "usu\u00e1rios"],
    [/\bPeriodo\b/g, "Per\u00edodo"],
    [/\bperiodo\b/g, "per\u00edodo"],
    [/\bInicio\b/g, "In\u00edcio"],
    [/\binicio\b/g, "in\u00edcio"],
    [/\bProximo\b/g, "Pr\u00f3ximo"],
    [/\bproximo\b/g, "pr\u00f3ximo"],
    [/\bProxima\b/g, "Pr\u00f3xima"],
    [/\bproxima\b/g, "pr\u00f3xima"],
    [/\bProximos\b/g, "Pr\u00f3ximos"],
    [/\bproximos\b/g, "pr\u00f3ximos"],
    [/\bProximas\b/g, "Pr\u00f3ximas"],
    [/\bproximas\b/g, "pr\u00f3ximas"],
    [/\bPossivel\b/g, "Poss\u00edvel"],
    [/\bpossivel\b/g, "poss\u00edvel"],
    [/\bPossiveis\b/g, "Poss\u00edveis"],
    [/\bpossiveis\b/g, "poss\u00edveis"],
    [/\bImpossivel\b/g, "Imposs\u00edvel"],
    [/\bimpossivel\b/g, "imposs\u00edvel"],
    [/\bMinimo\b/g, "M\u00ednimo"],
    [/\bminimo\b/g, "m\u00ednimo"],
    [/\bMaximo\b/g, "M\u00e1ximo"],
    [/\bmaximo\b/g, "m\u00e1ximo"],
    [/\bMaiuscula\b/g, "Mai\u00fascula"],
    [/\bmaiuscula\b/g, "mai\u00fascula"],
    [/\bMinuscula\b/g, "Min\u00fascula"],
    [/\bminuscula\b/g, "min\u00fascula"],
    [/\bConveniencia\b/g, "Conveni\u00eancia"],
    [/\bconveniencia\b/g, "conveni\u00eancia"],
    [/\bAtualizacao\b/g, "Atualiza\u00e7\u00e3o"],
    [/\batualizacao\b/g, "atualiza\u00e7\u00e3o"],
    [/\bAtualizacoes\b/g, "Atualiza\u00e7\u00f5es"],
    [/\batualizacoes\b/g, "atualiza\u00e7\u00f5es"],
    [/\bExecucao\b/g, "Execu\u00e7\u00e3o"],
    [/\bexecucao\b/g, "execu\u00e7\u00e3o"],
    [/\bExecucoes\b/g, "Execu\u00e7\u00f5es"],
    [/\bexecucoes\b/g, "execu\u00e7\u00f5es"],
    [/\bInvalido\b/g, "Inv\u00e1lido"],
    [/\binvalido\b/g, "inv\u00e1lido"],
    [/\bInvalida\b/g, "Inv\u00e1lida"],
    [/\binvalida\b/g, "inv\u00e1lida"],
    [/\bRapido\b/g, "R\u00e1pido"],
    [/\brapido\b/g, "r\u00e1pido"],
    [/\bMatricula\b/g, "Matr\u00edcula"],
    [/\bmatricula\b/g, "matr\u00edcula"],
    [/\bFuncionario\b/g, "Funcion\u00e1rio"],
    [/\bfuncionario\b/g, "funcion\u00e1rio"],
    [/\bFuncionarios\b/g, "Funcion\u00e1rios"],
    [/\bfuncionarios\b/g, "funcion\u00e1rios"],
  ];

  function fixText(raw) {
    let text = String(raw || "");
    if (!/[A-Za-z]/.test(text)) return text;

    for (const [pattern, replacement] of REPLACEMENTS) {
      text = text.replace(pattern, replacement);
    }

    text = text.replace(/\s+([,:.;!?])/g, "$1");
    return text;
  }

  function hasSkippedParent(node) {
    let current = node;
    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const tag = current.tagName;
        if (SKIP_TAGS.has(tag)) return true;
        if (current.isContentEditable) return true;
      }
      current = current.parentNode;
    }
    return false;
  }

  function processTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    if (hasSkippedParent(node)) return;
    const fixed = fixText(node.nodeValue);
    if (fixed !== node.nodeValue) {
      node.nodeValue = fixed;
    }
  }

  function processElementAttributes(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (SKIP_TAGS.has(el.tagName)) return;

    for (const attrName of ATTRS_TO_FIX) {
      if (!el.hasAttribute(attrName)) continue;
      const current = el.getAttribute(attrName);
      const fixed = fixText(current);
      if (fixed !== current) {
        el.setAttribute(attrName, fixed);
      }
    }

    if (el.tagName === "INPUT") {
      const type = String(el.getAttribute("type") || "").toLowerCase();
      if (type === "button" || type === "submit") {
        const value = el.getAttribute("value");
        const fixed = fixText(value);
        if (value !== null && fixed !== value) {
          el.setAttribute("value", fixed);
        }
      }
    }
  }

  function processSubtree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      processTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;

    if (root.nodeType === Node.ELEMENT_NODE) {
      processElementAttributes(root);
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        processTextNode(current);
      } else if (current.nodeType === Node.ELEMENT_NODE) {
        processElementAttributes(current);
      }
      current = walker.nextNode();
    }
  }

  function start() {
    processSubtree(document.body || document.documentElement);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          processTextNode(mutation.target);
          continue;
        }
        if (mutation.type === "attributes") {
          processElementAttributes(mutation.target);
          continue;
        }
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => processSubtree(node));
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS_TO_FIX,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
