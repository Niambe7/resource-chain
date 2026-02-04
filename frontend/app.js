const web3 = new Web3("http://127.0.0.1:7545");

const contractAddress = "0x6F45bD0Ab434031C8ac677a62A15f57cd9Ab5B30";

let contract;
let account;
let accounts = [];
let currentAccountIndex = 0;
let chainOffset = 0;
let isReady = false;
let cooldownRemaining = 0;
let lockRemaining = 0;
let cooldownSeconds = null;
const lastActionCache = new Map();

window.onload = async () => {
  try {
    const abiResponse = await fetch("./ResourceToken.json");
    if (!abiResponse.ok) {
      throw new Error("ABI introuvable: frontend/ResourceToken.json");
    }
    const abiJson = await abiResponse.json();
    const abi = abiJson.abi;

    accounts = await web3.eth.getAccounts();
    currentAccountIndex = 0;
    account = accounts[currentAccountIndex];

    document.getElementById("account").innerText = account;

    contract = new web3.eth.Contract(abi, contractAddress);
    isReady = true;

    showMessage("info", "Pret", "Compte connecte et contrat charge.");
    await syncChainTime();
    setupTokenIdWatcher();
    await loadResources();
    startCooldownTicker();
  } catch (err) {
    console.error("Init error:", err);
    showMessage("error", "Init bloque", err.message || "Chargement ABI/contrat impossible.");
  }
};

// --------------------
// Mint
// --------------------
async function mint() {
  try {
    if (!isReady || !contract) {
      showMessage("error", "Mint bloque", "Contrat non charge. Recharge la page.");
      return;
    }
    setBusy("mintBtn", true, "Mint...");
    const name = document.getElementById("name").value;
    const type = document.getElementById("type").value;
    const value = document.getElementById("value").value;
    const ipfsRaw = document.getElementById("ipfs").value;

    if (!name || !type || !ipfsRaw) {
      showMessage("error", "Mint bloque", "Remplis nom, type et hash IPFS.");
      return;
    }
    if (value === "" || isNaN(Number(value))) {
      showMessage("error", "Mint bloque", "La valeur doit etre un nombre.");
      return;
    }

    const ipfs = normalizeIpfs(ipfsRaw);

    await contract.methods
      .mintResource(account, name, type, value, ipfs)
      .send({
        from: account,
        gas: 500000
      });

    lastActionCache.set(account.toLowerCase(), getChainNow());
    showMessage("success", "Mint ok", "La ressource a ete mint avec succes.");
    await syncChainTime();
    await loadResources();
  } catch (err) {
    console.error("Erreur mint :", err);
    showMessage("error", "Mint bloque", getRevertReason(err));
  } finally {
    setBusy("mintBtn", false, "Mint");
  }
}

function normalizeIpfs(input) {
  const value = input.trim();
  if (value.startsWith("ipfs://")) {
    return value.replace("ipfs://", "");
  }
  // support full gateway URLs (pinata, ipfs.io, etc.)
  const match = value.match(/\/ipfs\/([a-zA-Z0-9]+)(?:\/.*)?$/);
  if (match && match[1]) return match[1];
  return value;
}

// --------------------
// Transfer
// --------------------
async function transfer() {
  try {
    if (!isReady || !contract) {
      showMessage("error", "Transfert bloque", "Contrat non charge. Recharge la page.");
      return;
    }
    setBusy("transferBtn", true, "Transfert...");
    const to = document.getElementById("to").value;
    const tokenId = document.getElementById("tokenId").value;

    if (!to) {
      showMessage("error", "Transfert bloque", "Adresse destinataire requise.");
      return;
    }
    if (tokenId === "" || isNaN(Number(tokenId))) {
      showMessage("error", "Transfert bloque", "Token ID doit etre un nombre.");
      return;
    }

    const tx = contract.methods.transferResource(to, tokenId);
    const gas = await tx.estimateGas({ from: account });
    await tx.send({ from: account, gas: Math.ceil(gas * 1.2) });

    lastActionCache.set(account.toLowerCase(), getChainNow());
    showMessage("success", "Transfert ok", "La ressource a ete transferee.");
    await syncChainTime();
    await loadResources();
  } catch (err) {
    console.error("Erreur transfert :", err);
    showMessage("error", "Transfert bloque", getRevertReason(err));
  } finally {
    setBusy("transferBtn", false, "Transferer");
  }
}

// --------------------
// Historique
// --------------------
async function loadHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  const tokenId = document.getElementById("historyTokenId").value;
  if (tokenId === "") {
    const li = document.createElement("li");
    li.className = "resource-item";
    li.innerText = "Entre un Token ID.";
    list.appendChild(li);
    return;
  }

  try {
    setBusy("historyBtn", true, "Chargement...");
    const owners = await contract.methods.getPreviousOwners(tokenId).call();
    if (!owners || owners.length === 0) {
      const li = document.createElement("li");
      li.className = "resource-item";
      li.innerText = "Aucun ancien proprietaire.";
      list.appendChild(li);
      return;
    }

    owners.forEach((addr, idx) => {
      const li = document.createElement("li");
      li.className = "resource-item";
      li.innerHTML = `<div>#${idx + 1}</div><small>${addr}</small>`;
      list.appendChild(li);
    });
  } catch (err) {
    const li = document.createElement("li");
    li.className = "resource-item";
    li.innerText = "Token invalide ou historique indisponible.";
    list.appendChild(li);
  } finally {
    setBusy("historyBtn", false, "Voir l'historique");
  }
}

// --------------------
// Affichage des ressources
// --------------------
async function loadResources() {
  if (!isReady || !contract) return;
  const list = document.getElementById("resources");
  list.innerHTML = "";

  const lockTime = await contract.methods.LOCK_TIME().call();
  const total = await contract.methods.nextTokenId().call();
  let shown = 0;

  for (let tokenId = 0; tokenId < Number(total); tokenId++) {
    try {
      const owner = await contract.methods.ownerOf(tokenId).call();
      if (owner.toLowerCase() !== account.toLowerCase()) {
        continue;
      }

      const resource = await contract.methods.resources(tokenId).call();
      const li = document.createElement("li");
      li.className = "resource-item";
      li.dataset.lastTransferAt = resource.lastTransferAt;
      li.dataset.lockTime = lockTime;
      li.innerHTML = `<div>#${tokenId} - ${resource.name} (${resource.resourceType})</div><small>valeur: ${resource.value} | verrou: <span class="lock-timer">--</span></small>`;
      list.appendChild(li);
      shown++;
    } catch (err) {
      // tokenId non minte ou inaccessible, ignorer
    }
  }

  if (shown === 0) {
    const li = document.createElement("li");
    li.className = "resource-item";
    li.innerText = "Aucune ressource pour ce compte.";
    list.appendChild(li);
  }

  await updateCooldownInfo();
  await updateLockInfo();
  updateResourceLocks();
}

async function switchAccount() {
  if (!accounts || accounts.length < 2) {
    showMessage("error", "Switch bloque", "Pas assez de comptes.");
    return;
  }
  currentAccountIndex = currentAccountIndex === 0 ? 1 : 0;
  account = accounts[currentAccountIndex];
  document.getElementById("account").innerText = account;
  showMessage("info", "Compte change", `Compte actif : ${account}`);
  await syncChainTime();
  await updateCooldownInfo();
  await loadResources();
}

function setBusy(buttonId, isBusy, label) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.disabled = isBusy;
  btn.textContent = label;
}

function showMessage(type, title, text) {
  const box = document.getElementById("message");
  const titleEl = document.getElementById("messageTitle");
  const textEl = document.getElementById("messageText");
  if (!box || !titleEl || !textEl) return;
  box.className = `message message--${type} show`;
  titleEl.textContent = title;
  textEl.textContent = text;
}

function getRevertReason(err) {
  const raw =
    err?.reason ||
    err?.data?.message ||
    err?.message ||
    "Transaction refusee.";
  const match = raw.match(/revert(?:ed)?(?::|\s+Reason given:)?\s*(.*)/i);
  if (match && match[1]) return match[1].trim();
  return raw;
}

async function syncChainTime() {
  try {
    const block = await web3.eth.getBlock("latest");
    chainOffset = Math.floor(Date.now() / 1000) - Number(block.timestamp);
  } catch (err) {
    // fallback: keep old time base
  }
}

function getChainNow() {
  return Math.floor(Date.now() / 1000) - chainOffset;
}

function formatRemaining(seconds) {
  if (seconds <= 0) return "pret";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

async function updateCooldownInfo() {
  const el = document.getElementById("cooldownInfo");
  if (!el) return;
  try {
    if (cooldownSeconds === null) {
      cooldownSeconds = Number(await contract.methods.COOLDOWN().call());
    }
    const key = account.toLowerCase();
    let last = lastActionCache.get(key);
    if (last === undefined) {
      last = Number(await contract.methods.lastActionTime(account).call());
      lastActionCache.set(key, last);
    }
    const now = getChainNow();
    cooldownRemaining = Number(last) + Number(cooldownSeconds) - now;
    el.innerHTML = `Cooldown: <strong>${formatRemaining(cooldownRemaining)}</strong>`;
  } catch (err) {
    cooldownRemaining = 0;
    el.innerHTML = "Cooldown: <strong>indisponible</strong>";
  }
}

async function updateLockInfo() {
  const el = document.getElementById("lockInfo");
  if (!el) return;
  const tokenIdRaw = document.getElementById("tokenId")?.value;
  if (tokenIdRaw === "") {
    lockRemaining = 0;
    el.innerHTML = "Verrou du token: <strong>--</strong>";
    return;
  }
  try {
    const lockTime = await contract.methods.LOCK_TIME().call();
    const resource = await contract.methods.resources(tokenIdRaw).call();
    const now = getChainNow();
    lockRemaining = Number(resource.lastTransferAt) + Number(lockTime) - now;
    el.innerHTML = `Verrou du token: <strong>${formatRemaining(lockRemaining)}</strong>`;
  } catch (err) {
    lockRemaining = 0;
    el.innerHTML = "Verrou du token: <strong>token invalide</strong>";
  }
}

function setupTokenIdWatcher() {
  const input = document.getElementById("tokenId");
  if (!input) return;
  input.addEventListener("input", () => {
    updateLockInfo();
  });
}

function startCooldownTicker() {
  setInterval(() => {
    updateCooldownInfo();
    updateLockInfo();
    updateResourceLocks();
    updateActionAvailability();
  }, 1000);
}

function updateResourceLocks() {
  const items = document.querySelectorAll("#resources .resource-item");
  if (!items.length) return;
  const now = getChainNow();
  items.forEach((item) => {
    const timer = item.querySelector(".lock-timer");
    if (!timer) return;
    const last = Number(item.dataset.lastTransferAt || 0);
    const lockTime = Number(item.dataset.lockTime || 0);
    const remaining = last + lockTime - now;
    timer.textContent = formatRemaining(remaining);
  });
}

function updateActionAvailability() {
  const mintBtn = document.getElementById("mintBtn");
  if (mintBtn) {
    mintBtn.disabled = cooldownRemaining > 0;
  }

  const transferBtn = document.getElementById("transferBtn");
  if (transferBtn) {
    transferBtn.disabled = cooldownRemaining > 0 || lockRemaining > 0;
  }
}
