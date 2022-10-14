"use strict";

var web3, provider, web3Modal, netId;

const Web3Modal = window.Web3Modal.default;
const WalletConnectProvider = window.WalletConnectProvider.default;
const EvmChains = window.evmChains;

/**
 * Disconnect wallet button pressed.
 *
 */
 function onDisconnect() {
  console.log("Killing the wallet connection", provider);

  if (provider.close) {
    provider.close();

    // If the cached provider is not cleared,
    // WalletConnect will default to the existing session
    // and does not allow to re-scan the QR code with a new wallet.
    // Depending on your use case you may want or want not his behavir.
    web3Modal.clearCachedProvider();
    provider = null;
  }

  // Set the UI back to the initial state
  // document.querySelector('#prepare').style.display = 'block';
  // document.querySelector('#connected').style.display = 'none';
  triggerEvent("selectAccount", null);
}

function init() {
  // if (location.protocol !== 'https:') {
  //     console.error("Not using HTTPS protocol...")
  //     document.querySelector("#btn-connect").setAttribute("disabled", "disabled")
  //     return;
  // }

  // Tell Web3modal what providers we have available.
  // Built-in web browser provider (only one can exist as a time)
  // like MetaMask, Brave or Opera is added automatically by Web3modal
  if (provider) {
    onDisconnect();
  }

  const providerOptions = {
    injected: {
      id: 1,
      display: {
        // logo: "/images/metamask.png",
        name: "Metamask",
      },
      package: null,
    },

    walletconnect: {
      id: 2,
      package: WalletConnectProvider,
      display: {
        // logo: "/images/trust-wallet.png",
        name: "Trust Wallet",
      },
      options: {
        // Mikko's test key - don't copy as your mileage may vary
        infuraId: "8043bb2cf99347b1bfadfb233c5325c0",
      },
    },

    // fortmatic: {
    //     package: Fortmatic,
    //     options: {
    //         // Mikko's TESTNET api key
    //         key: "pk_test_391E26A3B43A3350",
    //         network: "ropsten"
    //     }
    // }
  };

  web3Modal = new Web3Modal({
    cacheProvider: false, // optional
    providerOptions, // required
    disableInjectedProvider: false, // optional. For MetaMask / Brave / Opera.
  });
}

/**
 * Kick in the UI action after Web3modal dialog has chosen a provider
 */
function fetchAccountData() {
  // Get a Web3 instance for the wallet
  web3 = new Web3(provider);

  Promise.all([
    // Get connected chain id from Ethereum node
    netId ? Promise.resolve(0) : web3.eth.getChainId(),

    // Get list of accounts of the connected wallet
    web3.eth.getAccounts(),
  ])
    .then(([chainId, accounts]) => {
      // Load chain information over an HTTP API
      const chainData = netId ? Promise.resolve(0) : EvmChains.getChain(chainId);
      // document.querySelector("#network-name").textContent = chainData.name;

      // MetaMask does not give you all accounts, only the selected account
      triggerEvent("selectAccount", accounts[0], !netId ? chainData : { networkId: netId });

      setup();
      load();
    })
    .catch(console.log);
}

function refreshAccountData() {
  // If any current data is displayed when
  // the user is switching acounts in the wallet
  // immediate hide this data
  // document.querySelector("#connected").style.display = "none";
  // document.querySelector("#prepare").style.display = "block";

  // Disable button while UI is loading.
  // fetchAccountData() will take a while as it communicates
  // with Ethereum node via JSON-RPC and loads chain data
  // over an API call.

  // document.querySelector('#btn-connect').setAttribute('disabled', 'disabled');
  fetchAccountData();
  // document.querySelector('#btn-connect').removeAttribute('disabled');
}

/**
 * Connect wallet button pressed.
 */
function onConnect(resolve) {
  const providerResolve = resolve ? Promise.resolve(resolve) : web3Modal.connect()
  netId = resolve
    ? (window.ethereum.networkVersion ? +window.ethereum.networkVersion : +window.ethereum.chainId)
    : 0
  providerResolve.then((connectedProvider) => {
    provider = connectedProvider;

    if (provider.on) {
      // Subscribe to accounts change
      provider.on("accountsChanged", (accounts) => {
        fetchAccountData();
      });

      // Subscribe to chainId change
      provider.on("chainChanged", (chainId) => {
        netId = 0;
        fetchAccountData();
      });

      // Subscribe to networkId change
      // provider.on("networkChanged", (networkId) => {
      //   fetchAccountData();
      // });
    }

    refreshAccountData();
    $("button.js-popup-close").click();
  })
    .catch((e) => {
      console.log("Could not get a wallet connection", e);
      $("button.js-popup-close").click();
    });
}

// Loads once
function setup() { }

function initTokenContracts() {
  window.variables.FACTORY_CONTRACT = new web3.eth.Contract(
    window.variables.CONTRACT_FACTORY_ABI,
    window.variables.CONTRACT_FACTORY_ADDRESS
  );
  window.variables.PAIR_TOKEN_CONTRACTS = {};
  window.variables.SHARD_CONTRACT = new web3.eth.Contract(
    window.variables.CONTRACT_SHARD_ABI,
    window.variables.CONTRACT_SHARD_ADDRESS
  );
}

function registerToken({ address, ...token }) {
  const { CONTRACT_ERC20_ABI } = window.variables;
  window.variables.TOKEN_CONTRACTS[address] = {
    ...token,
    contract: new web3.eth.Contract(CONTRACT_ERC20_ABI, address),
  }
}

var balanceTimer = null;

var call = (method, resolve) => (...args) =>
  resolve
    ? new Promise((resolve) =>
      method(...args)
        .call()
        .then(resolve)
        .catch(() => resolve(null))
    )
    : method(...args).call();
var send = (method) => (...args) => {
  const option = args.pop();
  const transaction = method(...args);
  return {
    estimate: () => transaction.estimateGas(option),
    send: () => transaction.send(option),
    transaction,
  };
};

function getContractInfo() {
  const { ACCOUNT } = window.variables;
  if (ACCOUNT) {
    web3.eth
      .getBalance(ACCOUNT)
      .then((balance) => {
        window.variables.BALANCE = web3.utils.fromWei(balance);
        triggerEvent("fetchBalance");
      })
      .catch(console.log);
  }
}

function getTokenInfo(address = window.variables.ZERO) {
  const {
    ACCOUNT,
    TOKEN_CONTRACTS: { [address]: { contract, symbol, ...token } = {} },
    CONTRACT_ROUTER_ADDRESS,
  } = window.variables;
  const { decimals = 18 } = token;
  return Promise.all([
    !contract
      ? web3.eth.getBalance(ACCOUNT)
      : call(contract.methods.balanceOf)(ACCOUNT),
    !contract
      ? Promise.resolve(true)
      : call(contract.methods.allowance)(ACCOUNT, CONTRACT_ROUTER_ADDRESS),
  ]).then(([balance, allowance]) => [
    fromWei(new BigNumber(balance), decimals),
    !contract ? true : !fromWei(new BigNumber(allowance), decimals).isZero(),
    { ...token, symbol: symbol || BASE_SYMBOL, address },
  ]);
}

function load() {
  if (balanceTimer) clearInterval(balanceTimer);
  balanceTimer = setInterval(() => {
    getContractInfo();
  }, 1 * 60 * 1000);
  getContractInfo();
}

const networks = {
  1: {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ["https://mainnet.infura.io/v3"],
    blockExplorerUrls: ['https://etherscan.io/'],
  },
  56: {
    chainId: '0x38',
    chainName: 'Binance Smart Chain',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    blockExplorerUrls: ['https://bscscan.com/'],
  }
}

function changeNetworkRequest(network) {
  if (!networks[network]) return;
  web3.currentProvider.request({
    method: 'wallet_addEthereumChain',
    params: [
      networks[network],
    ],
  })
}

init();

const defaults = {
  transactions: [],
};

const networkLabels = {
  1: "ETH Mainnet",
  3: "ETH Ropsten",
  4: "ETH Rinkeby",
  56: "BSC Mainnet",
  97: "BSC Testnet",
};

const networkSuffix = {
  3: " Network",
  4: " Network",
};

const netURLs = {
  1: "https://etherscan.io",
  3: "https://ropsten.etherscan.io",
  4: "https://rinkeby.etherscan.io",
  56: "https://bscscan.com",
};

const scanApiURLs = {
  1: "https://api.etherscan.io",
  3: "https://api-ropsten.etherscan.io",
  4: "https://api-rinkeby.etherscan.io",
  56: "https://api.bscscan.com",
};

const netScans = {
  1: "Etherscan",
  3: "Etherscan(ropsten)",
  4: "Etherscan(rinkeby)",
  56: "Bscscan",
};

window.events = {
  onLoad: (...triggers) => {
    console.log("app loaded");
    triggerEvent("restoreSession");
    triggers.forEach(triggerEvent);
  },
  // Web3Modal
  connect: (idx) => {
    switch (Number(idx)) {
      case 1:
      case 2:
        $(`.web3modal-provider-wrapper:nth-child(${idx})`).click();
        localStorage.setItem("last_try", idx);
        break;
      default:
        break;
    }
  },
  restoreSession: () => {
    if (localStorage.getItem("last_connect")) {
      setTimeout(() => {
        onConnect(localStorage.getItem("last_connect") === '1' ? window.ethereum : null);
        triggerEvent("connect", localStorage.getItem("last_connect"));
      });
    } else if (window.ethereum) {
      onConnect(window.ethereum);
    }
  },
  selectAccount: (addr = "", chainData, ...triggers) => {
    // $(".connect-btn span").text(shortenAddr(addr));
    if (
      (!window.variables.ACCOUNT && addr) ||
      (window.variables.ACCOUNT && !addr)
    ) {
      // $(".user-connected").toggleClass("hidden");
      if (addr && localStorage.getItem("last_try")) {
        localStorage.setItem("last_connect", localStorage.getItem("last_try"));
      }
    }
    window.variables.ACCOUNT = addr;
    if (window.variables.NETWORK !== chainData.networkId) {
      configNetwork(chainData.networkId);
    }

    const { ACCOUNT, NETWORK } = window.variables;
    initTokenContracts();
    // selectToken(commonBases, tokens);

    ACCOUNT && NETWORK && triggers.forEach(triggerEvent);
  },
  networkChanged: (...triggers) => {
    console.log("Network changed", window.variables.NETWORK);
    triggers.forEach(triggerEvent);
  },
  searchChanged: (value) => {
    try {
      if (!value || !value.startsWith('0x')) return
      const { NETWORK, CONTRACT_ERC20_ABI } = window.variables;
      const address = toChecksumAddress(value);
      if ((window.variables.TOKEN_LIST[NETWORK] || []).find(token => token.address === address)) return
      const contract = new web3.eth.Contract(CONTRACT_ERC20_ABI, address);
      const logoURI = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`;
      Promise.all([
        call(contract.methods.symbol)(),
        call(contract.methods.name)(),
        call(contract.methods.decimals)(),
        urlCheck(logoURI)
      ]).then(([symbol, name, decimals, hasLogo]) => {
        services.tokenSuggest({
          address,
          decimals: Number(decimals),
          logoURI: hasLogo ? logoURI : 'images/swap/error.svg',
          name,
          symbol,
        });
      }).catch(console.log)
    } catch(e) {
      console.log(e);
    }
  },
  logout: () => {
    //
    onDisconnect();
  },
};

window.triggers = {};

window.services = {
  key: "hyper-perk",
  mounter: ".js-popup-open[href='#connect_wallet']",
  mounted: false,
  watch: null,
  tick: 5 * 1000,
  expire: 10 * 60 * 1000,
  toastExpire: 10,
  themes: ["light-mode", "dark-mode"],
  storage: defaults,
  importSuggest: {},
  load() {
    if (localStorage.getItem(this.key))
      this.storage = JSON.parse(localStorage.getItem(this.key));
    this.loadTheme();
    this.watch = setInterval(() => {
      this.checkTransactions();
    }, this.tick);
    this.updateToasts();

    $(document).on("click", "#toasts .btn", function () {
      const href = $(this).data("href");
      if (href) window.open(href);
      $(this).remove();
    });
  },
  save() {
    localStorage.setItem(this.key, JSON.stringify(this.storage));
    this.updateToasts();
  },
  get transactions() {
    const { NETWORK } = window.variables;
    if (!NETWORK) return [];
    return this.storage.transactions.filter(
      ({ network = 3 }) => network === NETWORK
    );
  },
  set transactions(receipts) {
    const hashes = receipts.map((item) => item.transactionHash);
    this.storage.transactions = this.transactions.map((item) => {
      const updated = hashes.includes(item.hash);
      if (updated) {
        const receipt = receipts.find(
          (receipt) => receipt.transactionHash === item.hash
        );
        this.toast({
          id: item.id,
          text: item.text,
          link: netLink(item.hash),
          status: receipt.status,
        });
        return {
          ...item,
          receipt,
        };
      }
      return item;
    });
    this.save();
    this.checkPending();
  },
  get pendingTransaction() {
    const timestamp = Date.now();
    return this.transactions.filter(
      ({ receipt, expireAt }) => !receipt && expireAt && expireAt > timestamp
    );
  },
  updateToasts() {
    if (!this.pendingTransaction.length && this.transactions.length) {
      $("#toasts .count .value").html(this.transactions.length);
      $("#toasts .count").show();
    } else {
      $("#toasts .count").hide();
    }
    const transactions = $(".transactions");
    if (this.transactions.length) {
      transactions.find(".transactions__description").hide();
      transactions.find("#clear-all").show();
      const items = transactions.find(".transactions__items");
      transactions.find(".transactions__items").show();
      items.html("");
      this.transactions.forEach(({ text, hash, receipt, network = 3 }) =>
        items.append(`
        <a href="${netLink(hash, network)}" target="_blank">
          ${text} <img src="/images/icons/${receipt ? (receipt.status ? "completed" : "failed") : "loading"
          }.svg" />
        </a>
      `)
      );
    } else {
      transactions.find(".transactions__description").show();
      transactions.find("#clear-all").hide();
      transactions.find(".transactions__items").hide();
    }
  },
  checkTransactions() {
    if (!web3 || !this.pendingTransaction.length) return;
    Promise.all(
      this.pendingTransaction.map(({ hash }) =>
        web3.eth.getTransactionReceipt(hash)
      )
    )
      .then((transactions) => {
        this.transactions = transactions.filter((item) => !!item);
      })
      .catch(console.log);
  },
  checkSupported() {
    const { NETWORK } = window.variables;
    if (NETWORK) {
      if (window.isETH === undefined) return;
      $(`.swap-toggle__btn:nth-child(${isETH ? 2 : 1}) input`).removeAttr('checked');
      $(`.swap-toggle__btn:nth-child(${isETH ? 1 : 2}) input`).attr('checked', 'checked');
      const base = $(".base-token");
      base.find(".ticker").text(BASE_SYMBOL);
      base.find(".descr").text(BASE_ASSET);
      base.find("img").attr("src", BASE_LOGO);
      if (SUPPORTED_NETWORKS.includes(NETWORK)) {
        $("#toasts .btn").remove();
        this.pendingTransaction.length > 0 && $("#toasts .count").show();
        this.checkPending();
      } else {
        $("#toasts .count").hide();
        $("#toasts .btn").remove();
        $("#toasts").append(`
        <button class="btn btn-gray ease-in">
          You are connected to ${networkLabels[NETWORK] + (networkSuffix[NETWORK] || "")
          }<br>
          <span>Our supported networks are ${SUPPORTED_NETWORKS.map(
            (network, index) => {
              const label = `<b>${networkLabels[network]}</b>`;
              return index === SUPPORTED_NETWORKS.length - 1
                ? `and ${label}`
                : label;
            }
          ).join(", ")}</span>
        </button>
      `);
      }
    }
  },
  checkPending() {
    const { NETWORK } = window.variables;
    if (NETWORK) {
      const pending = this.pendingTransaction.length;
      if (pending) {
        this.mount(pending);
      } else {
        this.unMount();
        this.updateToasts();
      }
    }
  },
  mount(count) {
    if (!this.mounted) {
      const mount = $(this.mounter);
      mount.css("position", "relative");
      mount.append(`
        <a href="#transactions" class="services-mounted js-popup-open">${count} pending</a>
      `);
      this.mounted = true;
    } else {
      $(".connect-btn a[href='#transactions']").text(`${count} pending`);
    }
  },
  unMount() {
    const mount = $(this.mounter);
    mount.find("[href='#transactions']").remove();
    this.mounted = false;
  },
  clear() {
    this.storage.transactions = [];
    this.save();
  },
  push(transaction) {
    const { NETWORK } = window.variables;
    const timestamp = Date.now();
    this.storage.transactions.unshift({
      ...transaction,
      id: timestamp.toString(),
      expireAt: Date.now() + this.expire,
      network: NETWORK,
    });
    this.save();
    this.checkPending();
  },
  update(receipt) {
    this.transactions = [receipt];
  },
  toast({ id, text, link, status }) {
    const container = $("#toasts");
    container.append(`
      <button class="btn btn-${status ? "lbiege" : "gray"
      }" data-href="${link}" id="tx-${id}">
        ${text} (<span>${status ? "Completed" : "Failed"}</span>)
      </button>
    `);
    setTimeout(() => $(`#tx-${id}`).addClass("ease-in"), 0.5 * 1000);
    setTimeout(
      () => $(`#tx-${id}`).removeClass("ease-in").addClass("ease-out"),
      this.toastExpire * 1000
    );
    setTimeout(() => $(`#tx-${id}`).remove(), (this.toastExpire + 0.5) * 1000);
  },
  toggleTheme() {
    const { theme: origin = 0 } = this.storage;
    $(document.body).removeClass(this.themes[origin]);
    this.storage.theme = (origin + 1) % this.themes.length;
    this.loadTheme();
    this.save();
  },
  loadTheme() {
    const { theme = 0 } = this.storage;
    $(".dark-mode-toggle input").attr("checked", theme === 1);
    $(document.body).addClass(this.themes[theme]);
  },
};

window.events.load = function load() {
  services.load();
};

window.events.checkSupported = function checkSupported() {
  services.checkSupported();
};

window.triggers.onLoad = [...(window.triggers.onLoad || []), "load"];
window.triggers.networkChanged = [
  ...(window.triggers.networkChanged || []),
  "checkSupported",
];

function triggerEvent(key, ...params) {
  if (window.events[key]) {
    window.events[key](...params, ...(window.triggers[key] || []));
  }
}

function getBindEvent(target, eventKey) {
  return $(target).attr(eventKey);
}

function getTargetEvent(e, eventKey) {
  let target = e.target;
  while (target && !getBindEvent(target, eventKey)) {
    target = target.parentElement;
  }
  if (!target) return "";
  return $(target).attr(eventKey).split(":");
}

function netScan(network) {
  const { NETWORK } = window.variables;
  return netScans[network || NETWORK];
}

function netLink(hash, network) {
  const { NETWORK } = window.variables;
  return `${netURLs[network || NETWORK]}/tx/${hash}`;
}

$(window).on("load", () => {
  window.variables.TOKEN_LIST = {
    4: [{
      address: "0x99BB38c25711ac1915FD0E9781ddBC421Fc0f625",
      decimals: 18,
      logoURI: null,
      name: "Sword Token",
      symbol: "SWARD",
    }, {
      address: "0x5D592120FfA6d8FDE0Bf05a06A8c0A94a6377C62",
      decimals: 18,
      logoURI: null,
      name: "Uniswap V2 LP",
      symbol: "LP",
    }]
  };
  triggerEvent("onLoad");

  $(document).on("click", "[data-popup-dismiss]", function (e) {
    const bind = getBindEvent(e.target, "data-popup-dismiss");
    if (bind) {
      $(`#${bind}`).removeClass("is-active");
    }
  });

  $(document).on("click", "[data-event-click]", function (e) {
    e && e.preventDefault();
    const [key, params = ""] = getTargetEvent(e, "data-event-click");
    if (window.events[key]) triggerEvent(key, e, ...params.split(","));
  });

  $(document).on("change", "[data-event-change]", function (e) {
    const [key, params = ""] = getTargetEvent(e, "data-event-change");
    if (window.events[key]) triggerEvent(key, e, ...params.split(","));
  });

  $(document).on("keyup", "[data-event-input]", function (e) {
    const [key, params = ""] = getTargetEvent(e, "data-event-input");
    if (window.events[key]) triggerEvent(key, e, ...params.split(","));
  });

  $(document).on("submit", "[data-submit]", function (e) {
    e.preventDefault();
    const [key] = getTargetEvent(e, "data-submit");
    if (window.events[key]) triggerEvent(key);
  });
  // $(document).tooltip();
});

function getZeros(len) {
  return new Array(len).fill(0).join("");
}

function getNumberInString(seq = 30) {
  return new BigNumber(`1${getZeros(seq)}`);
}

function toFixed(value, decimals) {
  return new BigNumber(value.toFixed(decimals, 1));
}

function toWei(value, decimals = 18) {
  return toFixed(value.times(10 ** decimals), 0);
}

function fromWei(value, decimals = 18) {
  return toFixed(value.div(10 ** decimals), decimals);
}

function getData(elem, key = "key") {
  return elem.data(key);
}

function shortenAddr(address) {
  if (!address) return 'Unlock Wallet';
  return `${address.substr(0, 5)}...${address.substr(-4)}`;
}

async function getBlockInfo() {
  return new Promise((resolve, reject) => {
    window.web3.eth.getBlockNumber((err, blockNumber) => {
      if (err !== null) {
        reject(err);
      } else {
        resolve(window.web3.eth.getBlock(blockNumber));
      }
    });
  });
};

$(document).ready(function () {
  $.expr[":"].contains = $.expr.createPseudo(function (arg) {
    return function (elem) {
      return $(elem).text().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
    };
  });

  $(document).on("click", 'a[href="#"]', function (e) {
    e.preventDefault();
  });

  popups();
}); // end ready

function popups() {
  $(document).on("click", ".js-popup-open", function (e) {
    onConnect();
    var _id = $(this).attr("href");
    $(_id).fadeIn(200);

    document.body.style.overflow = "hidden";

    if (_id == "#login_using") {
      var walletName = $(this).find("span").text();
      var walletLogoSrc = $(this).find("img").attr("src");
      $(_id).find("#wallet_name").text(walletName);
      $(_id).find("#wallet_logo").attr("src", walletLogoSrc);
    } else if (_id === "#metamask") {
      triggerEvent("connect", 1);
    } else if (_id === "#walletconnet") {
      triggerEvent("connect", 2);
    }

    if (_id == "#confirm_supply") {
      $(_id).find(".popup__body-content-title").text($(this).attr("data-title"));
      $(_id).find(".popup__body-content-reward-amount").text($(this).attr("data-value"));
      $(_id).find(".popup__body-content-reward-token0").attr("src", $(this).attr("data-from-logo"));
      $(_id).find(".popup__body-content-reward-token1").attr("src", $(this).attr("data-to-logo"));
      $(_id)
        .find(".popup__body-tesc")
        .text($(this).attr("data-from-symbol") + "/" + $(this).attr("data-to-symbol") + " Pool Tokens");
      $(_id)
        .find(".popup__body-details-item-name.token0")
        .text($(this).attr("data-from-symbol") + " Deposited");
      $(_id)
        .find(".popup__body-details-item-value.token0")
        .find(".popup__body-details-item-value-image")
        .attr("src", $(this).attr("data-from-logo"));
      $(_id)
        .find(".popup__body-details-item-value.token0")
        .find(".popup__body-details-item-value-text")
        .text($(this).attr("data-from-amount"));
      $(_id)
        .find(".popup__body-details-item-name.token1")
        .text($(this).attr("data-to-symbol") + " Deposited");
      $(_id)
        .find(".popup__body-details-item-value.token1")
        .find(".popup__body-details-item-value-image")
        .attr("src", $(this).attr("data-to-logo"));
      $(_id)
        .find(".popup__body-details-item-value.token1")
        .find(".popup__body-details-item-value-text")
        .text($(this).attr("data-to-amount"));
      $(_id).find(".popup__body-details-item-value.rates").html(`
        <div class="popup__body-details-item-value-rates">1 ${$(this).attr("data-from-symbol")} = ${$(this).attr(
        "data-from-rate"
      )} ${$(this).attr("data-to-symbol")}</div>
        <div class="popup__body-details-item-value-rates">1 ${$(this).attr("data-to-symbol")} = ${$(this).attr(
        "data-to-rate"
      )} ${$(this).attr("data-from-symbol")}</div>
      `);
      $(_id)
        .find(".popup__body-details-item-value.share-of-pool")
        .text($(this).attr("data-percent") + "%");
      $(_id).find("button.js-confirm-btn").text($(this).attr("data-text"));
    }

    if (_id == "#stake_asset") {
      $(_id).find("#stake_dialog_title").text($(this).attr("data-title"));

      const type = $(this).attr("data-type");
      const availableAmount = $(this).attr("data-amount");
      $(_id)
        .find(".available-balance-value")
        .text(`${new BigNumber(availableAmount).toFixed(8)} SLP`);
      $(_id).find(".js-input-max-balance").attr("data-value", `${availableAmount}`);
      $(_id).find("#current_pool_id").val($(this).attr("data-id"));
      $(_id).find("#current_stake_type").val($(this).attr("data-type"));
      $(_id).find("#current_pool_pair_name").val($(this).attr("data-name"));
      $(_id).find("#available_amount").val("");

      $("#stake_asset .js-confirm-btn").attr("disabled", false);
    }

    if (_id == "#confirm_remove") {
      triggerEvent("initRemoveModal");
    }

    return false;
  });
  $(document).on("click", ".js-popup-close", function () {
    $(this).closest(".popup-overlay").removeAttr("data-input").fadeOut(200);
    document.body.style.overflow = "";
  });
  $(document).on("click touchend", function (e) {
    var container = $(".popup");
    if (container.length && !$(e.target).closest(container).length && $(".popup-overlay").is(":visible")) {
      $(".popup-overlay").removeAttr("data-input").fadeOut(200);
      document.body.style.overflow = "";
    }
  });
}
