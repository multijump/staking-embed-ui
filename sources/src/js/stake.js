"use strict";

$(window).on("load", () => {
// window.onload = function () {
  renderPopup()
  if ($('.stake-embed').length) {
    renderForm($('.stake-embed'))
  }
  window.variables.POOL = {
    LOADDING_APPROVE: 0
  };
  window.triggers.selectAccount = [...(window.triggers.selectAccount || []), "init"];
  window.events.init = initFarm;
  window.events.onModalClose = onModalClose;

  $(document).on('click', '.btn-approve-staking', function (e) {
    e.preventDefault()

    const name = $(this).attr('data-name')
    approveStaking(name)
  })

  $(document).on('click', '.btn-staking', function (e) {
    e.preventDefault()
    const { POOL } = window.variables;
    const stakeEarnedAmount = $("#stake-amount").val();
    const amount = new BigNumber(stakeEarnedAmount);
    const maxAmount = new BigNumber(POOL.maxStake);
    const availableAmount = new BigNumber(POOL.balance);
    if ((amount.gt(new BigNumber(0)) &&
      amount.lte(availableAmount) &&
      amount.lte(maxAmount) &&
      POOL.id)) {
      $('.stake-embed-form__notice').html('')
      $('.btn-staking').attr('disabled', true)
      $('.btn-staking').html(`<div class="btn-loader"></div>`)
      runStake(POOL.id, amount.toString(10), POOL.tokenSymbol, "stake", function (result, error) {
        $('.btn-staking').removeAttr('disabled')
        $('.btn-staking').html('Stake')
        if (error) {
          console.log(error)
        }
        updatePool();
      })
    } else if (amount.isZero() || !stakeEarnedAmount) {
      $('.stake-embed-form__notice').text('Please input your stake amount.');
    } else if (maxAmount.isZero()) {
      $('.stake-embed-form__notice').text('Event ended. You cannot stake anymore.');
    } else if (amount.gt(availableAmount) && maxAmount.lte(availableAmount)) {
      $('.stake-embed-form__notice').text(`Exceed max stake amount. You can stake only ${maxAmount.toString(10)} ${POOL.tokenSymbol} now.`);
    } else if (amount.gt(availableAmount) && maxAmount.gt(availableAmount)) {
      $('.stake-embed-form__notice').text(`Exceed max stake amount. You can stake only ${availableAmount.toString(10)} ${POOL.tokenSymbol} now.`);
    } else {
      $('.stake-embed-form__notice').text(`Exceed max amount. You can stake only ${maxAmount.minus(new BigNumber(
        POOL.user ? (POOL.user[POOL.id]?.amount || 0) / 1e18 : 0,
      )).toString(10)} ${POOL.tokenSymbol} now.`);
    }
  })

  $(document).on('click', '.btn-unstaking', function (e) {
    e.preventDefault()
    const { POOL } = window.variables;
    const stakeEarnedAmount = $("#stake-amount").val();
    const amount = new BigNumber(stakeEarnedAmount);
    const availableAmount = new BigNumber(POOL.balance);

    if (amount.gt(new BigNumber(0)) &&
      amount.lte(availableAmount) &&
      pid &&
      type === "unstake") {
        runStake(POOL.id, amount.toString(10), POOL.tokenSymbol, "stake", function (result, error) {
        if (error) {
          console.log(error)
        }
        updatePool();
      })
    } else {
      $('.stake-embed-form__notice').text(`Exceed unstake amount. You can unstake only ${maxAmount.minus(new BigNumber(
        POOL.user ? (POOL.user[POOL.id]?.amount || 0) / 1e18 : 0,
      )).toString(10)} ${POOL.tokenSymbol} now.`);
    }
  })

  $(document).on('click', '.btn-harvest', function (e) {
    e.preventDefault()
    const { POOL } = window.variables;
    const amount = new BigNumber($('#stake-earned-amount').val())

    if (amount.isZero() || amount.isNaN()) {
      $('.stake-embed-form__notice').text('Please input your claim amount.');
      return;
    }
    harvestNow(POOL.id, amount.toString(10))
  })

  $(document).on('click', '.btn-max-amount', function (e) {
    e.preventDefault()
    const { POOL } = window.variables;
    const appPoolButton = $(".btn-add-pool");

    const pairMaxStake = new BigNumber(POOL.maxStake).div(1e18)
    const pairCurrentStaked = new BigNumber(
      POOL.user ? (POOL.user[POOL.id]?.amount || 0) / 1e18 : 0,
    )
    const maxAmount = pairMaxStake.minus(pairCurrentStaked);

    if (new BigNumber(POOL.maxStake).isZero()) {
      $('#stake-amount')
        .val(
          pairCurrentStaked
            .dp(18, 1)
            .toString(10),
        )
    } else {
      const availableAmount = new BigNumber(POOL.balance)
      if (availableAmount.gt(maxAmount)) {
        $('#stake-amount')
          .val(
            maxAmount
              .dp(18, 1)
              .toString(10),
          )
      } else {
        $('#stake-amount')
          .val(
            availableAmount
              .dp(18, 1)
              .toString(10),
          )
      }
    }
  })

  checkValid();
});

function renderPopup() {
  $('body').append(`
    <div class="popup-overlay" id="connect_wallet">
      <div class="popup">
        <div class="popup__close js-popup-close"></div>
        <div class="popup__title">
          <h6>Connect to a wallet</h6>
        </div>
        <div class="wallet-list" data-scroll-lock-scrollable >
          <a href="#metamask" class="wallet-list__item js-popup-open">
            <img src="images/metamask.svg" alt="" />
            <span>MetaMask</span>
          </a>
          <a href="#walletconnet" class="wallet-list__item js-popup-open">
            <img src="images/walletconnect.svg" alt="" />
            <span>WalletConnect</span>
          </a>
        </div>
        <div class="popup__about-wallets" >New to Ethereum?
          <a href="#">Learn more about wallets</a>
        </div>
      </div>
    </div>
    <div class="popup-overlay" id="transactions" data-scroll-lock-scrollable>
      <div class="popup popup--select-token">
        <div class="popup__close js-popup-close"></div>
        <div class="popup__title">
          <h6>Transactions</h6>
        </div>
        <div class="transactions">
          <div class="common-bases__title">
            Recent transactions
            <span id="clear-all" data-service-click="clear">(clear-all)</span>
          </div>
          <div class="transactions__description">Your transactions will appear here...</div>
          <div class="transactions__items">
            <a href="#" data-key="0x0000000000000000000000000000000000000000">
              <span class="ticker">Waiting...</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `)
}

function renderForm(element) {
  element.html(`
      <form class="stake-embed-form" action="#" data-submit="disabled">
        <div class="stake-embed-form__title">
          <h6>CONDUCTIVE - SWORD</h6>
        </div>
        <div class="stake-embed-form__subtitle">
          <h6>Earn SHARD</h6>
          <div class="stake-embed-form__subtitle--event"></div>
        </div>
        <div class="stake-embed-form__info">
          <div class="stake-embed-form__info-earned"></div>
          <div class="stake-embed-form__info-staked"></div>
          <div class="stake-embed-form__info-balance"></div>
          <div class="stake-embed-form__info-stakable"></div>
        </div>
        <div class="stake-embed-form__notice"></div>
        <div class="stake-embed-form__inputs">
          <div class="stake-embed-form__input">
            <div class="stake-embed-form__input-header">
              <div class="stake-embed-form__input-header-title">SHARD EARNED</div>
            </div>
            <div class="stake-embed-form__input-row stake-embed-form__earned" data-input="claim-amount">
              <input id="stake-earned-amount" placeholder="0.00" data-event-input="onInputAmount:earnedAmount" disabled="">
              <button class="btn btn-small btn-harvest" href="#" disabled="disabled">Claim</button>
            </div>
          </div>
          <div class="stake-embed-form__input">
            <div class="stake-embed-form__input-header">
              <div class="stake-embed-form__input-header-title" id="stake-token-label">CONDUCTIVE - SWORD STAKED</div>
            </div>
            <div class="stake-embed-form__input-row stake-embed-form__max-stake" data-input="amount">
              <input id="stake-amount" placeholder="0.00" data-event-input="onInputAmount:amount">
              <button class="btn btn-max-amount" href="#">MAX</button>
            </div>
          </div>
        </div>
        <div class="btn-add-pool">
          <button class="btn btn-big btn-approve-staking href="#">Approve Staking</button>
          <button class="btn btn-big btn-approve-staking href="#stake_asset">Stake</button>
          <button class="btn btn-big btn-approve-staking href="#unstake_asset">UnStake</button>
        </div>
      </form>
  `)
}


function initFarm() {
  const { ACCOUNT, INIT } = window.variables;
  const bgColor = INIT ? INIT.bgColor : null;
  const buttonColor = INIT ? INIT.buttonColor : null;
  const buttonText = INIT ? INIT.buttonText : null;
  const textColor = INIT ? INIT.textColor : null;
  const title = (INIT ? INIT.title : null) || 'CONDUCTIVE - SWORD';

  if (bgColor) {
    $('.stake-embed-form').css('backgroundColor', `#${bgColor}`)
  }
  $('.stake-embed-form__title h6').html(title);
  $('#stake-token-label').html(`${title} STAKED`)
  if (buttonColor) {
    $('.btn-harvest').css('backgroundColor', `#${buttonColor}`)
  }
  if (textColor) {
    $('.stake-embed-form__title h6').css('color', `#${textColor}`)
    $('.stake-embed-form__subtitle').css('color', `#${textColor}`)
    $('.stake-embed-form__info').css('color', `#${textColor}`)
    $('.stake-embed-form__input-header div').css('color', `#${textColor}`)
  }
  $('.stake-embed-form__info').hide()

  if (ACCOUNT) {
    updatePool();
  }
}

function updatePool() {
  const { ACCOUNT, CONTRACT_ERC20_ABI, CONTRACT_FACTORY_ADDRESS, FACTORY_CONTRACT, INIT } = window.variables;
  const token = INIT ? INIT.token : null || '0x99BB38c25711ac1915FD0E9781ddBC421Fc0f625'; // SWORD token

  if (toChecksumAddress(token)) {
    initData(function (pools) {
      const pool = pools.find(p => toChecksumAddress(p.token) === toChecksumAddress(token));
      if (pool) {
        const tokenContract = new web3.eth.Contract(
          CONTRACT_ERC20_ABI,
          toChecksumAddress(pool.token)
        )
      
        Promise.all([
          Promise.resolve(pool.token),
          call(tokenContract.methods.name)(),
          call(tokenContract.methods.decimals)(),
          call(tokenContract.methods.symbol)(),
          call(tokenContract.methods.balanceOf)(ACCOUNT),
          call(tokenContract.methods.allowance)(
            ACCOUNT,
            CONTRACT_FACTORY_ADDRESS
          ),
          call(FACTORY_CONTRACT.methods.pendingSecondaryToken)(pool.id, ACCOUNT),
          getPoolUser(ACCOUNT),
        ])
          .then(([tokenAddress, tokenName, decimal, tokenSymbol, balance, allowance, reward, user]) => {
            window.variables.POOL = {
              ...pool,
              tokenAddress,
              tokenName,
              decimal,
              tokenSymbol,
              balance: web3.utils.fromWei(balance, "ether"),
              allowance: Number(web3.utils.fromWei(allowance, "ether")),
              reward: Number(web3.utils.fromWei(reward, "ether")),
              user,
              tokenContract
            }
      
            checkValid();
          })
      } else {
        console.log('incorrect token address!!!!!')
      }
    })
  }
}

function initData(callback) {
  if (window.variables.FACTORY_CONTRACT) {
    Promise.all([getPools()])
      .then(function ([pools]) {
        callback(pools)
      })
      .catch(console.log)
  }
}

function checkValid() {
  const appPoolButton = $(".btn-add-pool");
  const { ACCOUNT, POOL, INIT } = window.variables;

  const buttonColor = INIT ? INIT.buttonColor : null;

  $("#stake-earned-amount").val(POOL.reward);
  if (new BigNumber(POOL.balance).isZero()) {
    $("#stake-amount").hide();
    $(".btn-max-amount").hide();
  } else {
    $("#stake-amount").show();
    $(".btn-max-amount").show();
  }

  if (new BigNumber(POOL.maxStake).isZero()) {
    $(".stake-embed-form__title--event").text('');
  } else {
    $(".stake-embed-form__title--event").text('Event ended');
  }

  if (!ACCOUNT) {
    if (buttonColor) {
      $(appPoolButton).html(`<button class="btn btn-big js-popup-open" href="#connect_wallet" style="background-color: #${buttonColor}">Connect Wallet</button>`);
    } else {
      $(appPoolButton).html(`<button class="btn btn-big js-popup-open" href="#connect_wallet">Connect Wallet</button>`);
    }
    $('.btn-harvest').attr('disabled', true)
    $('.btn-harvest').css('backgroundColor', '#dee2e6')
    return;
  }

  $('.stake-embed-form__info').show()
  $('.stake-embed-form__info-earned').html(`<span>Current Earned : </span><span>${POOL.reward} SHARD</span>`)
  $('.stake-embed-form__info-staked').html(`<span>Current Staked : </span><span>${new BigNumber(POOL.user[POOL.id].amount).div(new BigNumber(10).pow(POOL.decimal)).toString(10)} ${POOL.tokenSymbol}</span>`)
  $('.stake-embed-form__info-balance').html(`<span>Current Balance : </span><span>${new BigNumber(POOL.balance).dp(2, 1).toString(10)} ${POOL.tokenSymbol}</span>`)

  const pairMaxStake = new BigNumber(POOL.maxStake).div(1e18)
  const pairCurrentStaked = new BigNumber(
    POOL.user ? (POOL.user[POOL.id]?.amount || 0) / 1e18 : 0,
  )
  const maxAmount = pairMaxStake.minus(pairCurrentStaked);

  if (pairMaxStake.isZero()) {
    $('.stake-embed-form__info-stakable').html(`<span>Available Stake Amount : </span><span>${pairCurrentStaked.dp(2, 1).toString(10)} ${POOL.tokenSymbol}</span>`)
  } else {
    const availableAmount = new BigNumber(POOL.balance)
    if (availableAmount.gt(maxAmount)) {
      $('.stake-embed-form__info-stakable').html(`<span>Available Stake Amount : </span><span>${maxAmount.dp(2, 1).toString(10)} ${POOL.tokenSymbol}</span>`)
    } else {
      $('.stake-embed-form__info-stakable').html(`<span>Available Stake Amount : </span><span>${availableAmount.dp(2, 1).toString(10)} ${POOL.tokenSymbol}</span>`)
    }
  }

  if (!POOL.reward) {
    $('.btn-harvest').attr('disabled', true)
    $('.btn-harvest').css('backgroundColor', '#dee2e6')
  } else {
    $('.btn-harvest').removeAttr('disabled')
    if (buttonColor) {
      $('.btn-harvest').css('backgroundColor', `#${buttonColor}`)
    } else {
      $('.btn-harvest').css('backgroundColor', '')
    }
  }
  if (POOL && !POOL.allowance) {
    if (buttonColor) {
      $(appPoolButton).html(`<button class="btn btn-big btn-approve-staking" href="#" data-name="${POOL.tokenSymbol}" style="background-color: #${buttonColor}">Approve Staking</button>`);
    } else {
      $(appPoolButton).html(`<button class="btn btn-big btn-approve-staking" href="#" data-name="${POOL.tokenSymbol}">Approve Staking</button>`);
    }
    return;
  }

  if (new BigNumber(POOL.maxStake).isZero()) {
    if (buttonColor) {
      $(appPoolButton).html(`<button
                            class="btn btn-big btn-unstaking"
                            href="#unstake_asset"
                            data-id="${POOL.id}"
                            data-address="${POOL.token}"
                            data-name="${POOL.tokenSymbol}"
                            data-type="unstake"
                            data-amount="${
                              new BigNumber(POOL.user[POOL.id]?.amount)
                                .div(1e18)
                                .toString(10) || 0
                            }"
                            data-title="Withdraw"
                            style="background-color: #${buttonColor}">UnStake and Claim</button>`);
    } else {
      $(appPoolButton).html(`<button
                            class="btn btn-big btn-unstaking"
                            href="#unstake_asset"
                            data-id="${POOL.id}"
                            data-address="${POOL.token}"
                            data-name="${POOL.tokenSymbol}"
                            data-type="unstake"
                            data-amount="${
                              new BigNumber(POOL.user[POOL.id]?.amount)
                                .div(1e18)
                                .toString(10) || 0
                            }"
                            data-title="Withdraw">UnStake and Claim</button>`);
    }
  } else {
    if (buttonColor) {
      $(appPoolButton).html(`<button
                            class="btn btn-big btn-staking"
                            href="#stake_asset"
                            data-id="${POOL.id}"
                            data-address="${POOL.token}"
                            data-name="${POOL.tokenSymbol}"
                            data-type="stake"
                            data-amount="${POOL.balance}"
                            data-max-amount="${POOL.maxStake}"
                            data-current-staked="${new BigNumber(
                              POOL.user ? (POOL.user[POOL.id]?.amount || 0) / 1e18 : 0,
                            )}"
                            data-title="Deposit"
                            style="background-color: #${buttonColor}">Stake</button>`);
    } else {
      $(appPoolButton).html(`<button
                            class="btn btn-big btn-staking"
                            href="#stake_asset"
                            data-id="${POOL.id}"
                            data-address="${POOL.token}"
                            data-name="${POOL.tokenSymbol}"
                            data-type="stake"
                            data-amount="${POOL.balance}"
                            data-max-amount="${POOL.maxStake}"
                            data-current-staked="${new BigNumber(
                              POOL.user ? (POOL.user[POOL.id]?.amount || 0) / 1e18 : 0,
                            )}"
                            data-title="Deposit">Stake</button>`);
    }
  }
}

function approveStaking(name) {
  const {
    ACCOUNT,
    CONTRACT_FACTORY_ADDRESS,
    POOL: {
      LOADDING_APPROVE,
      tokenContract
    },
  } = window.variables;

  if (ACCOUNT && !LOADDING_APPROVE) {
    window.variables.POOL.LOADDING_APPROVE = 1;
    $('.btn-approve-staking').attr('disabled', true)
    $('.btn-approve-staking').html(`<div class="btn-loader"></div>`)

    send(
      tokenContract.methods.approve
    )(
      CONTRACT_FACTORY_ADDRESS,
      new BigNumber(2).pow(256).minus(1).toString(10),
      { from: ACCOUNT }
    )
      .send()
      .on("transactionHash", (hash) => {
        window.variables.POOL.LOADDING_APPROVE = 0;
        window.variables.POOL.allowance = 1.157920892373162e+59;
        services.push({ text: `Approve ${name}`, hash });
        checkValid();
      })
      .on("receipt", (receipt) => {
        window.variables.POOL.LOADDING_APPROVE = 0;
        services.update(receipt);
        $('.btn-approve-staking').removeAttr('disabled')
        $('.btn-approve-staking').html(`Approve Staking`)
      })
      .on("error", (error, receipt) => {
        window.variables.POOL.LOADDING_APPROVE = 0;
        if (receipt) services.update(receipt);
        $('.btn-approve-staking').removeAttr('disabled')
        $('.btn-approve-staking').html(`Approve Staking`)
      });
  } else {
    console.log('choose account')
  }
}

function harvestNow(pid, earning) {
  $('.btn-harvest').attr('disabled', true)
  $('.btn-harvest').html(`<div class="btn-loader"></div>`)
  runHarvest([pid, earning], function (result, error) {
    $('.btn-harvest').removeAttr('disabled')
    $('.btn-harvest').html('Claim')
    if (error) {
      console.log(error)
      return
    }
    $('.stake-embed-form__notice').html(`You're earning the ${earning} SHARD`);
  })
}

function clear() {
  
}

function toChecksumAddress(address) {
  if (!web3) return address;

  try {
    return web3.utils.toChecksumAddress(address);
  } catch(e) {
    return false;
  }
}

function handleTransactionSuccess(hash) {
  $(".popup-overlay#pending_supply").fadeOut(200);
  $(".popup-overlay#transaction_status").fadeIn(200);
  $(".popup-overlay .popup__transaction-title").text("Transaction Submitted");
  $(".popup-overlay .popup__transaction-title").after(`
    <a
      target="_blank"
      rel="noopener noreferrer"
      href="${netLink(hash)}"
      class="popup__transaction-link">
      View on ${netScan()}
    </a>
  `);
  $(".popup-overlay .popup__transaction-btn").text("Close");
  clear();
}

function handleTransactionError() {
  $(".popup-overlay#pending_supply").fadeOut(200);
  $(".popup-overlay#transaction_status").fadeIn(200);
  $(".popup-overlay .popup__transaction-title").text("Transaction Rejected.");
  $(".popup-overlay .popup__transaction-btn").text("Dismiss");
}

function onModalClose() {
  $(".popup-overlay").fadeOut(200);
}
