"use strict";

window.onload = function () {
  window.triggers.selectAccount = [...(window.triggers.selectAccount || []), "init"];
  window.events.init = init;
  window.events.onModalClose = onModalClose;

  $('#admin-token-functions').on('change', function(e) {
    const functionName = $(e.target).val();

    if (functionName === 'renounceMinter' || functionName === 'renounceCanTransfer') {
      $('#admin-factory-token').val('')
      $('#admin-factory-token').attr('disabled', true)
    } else {
      $('#admin-factory-token').removeAttr('disabled')
    }
  });
};

function init() {
  console.log(window.variables)

  checkValid();
}

function checkValid() {
  const appPoolButton = $(".btn-add-pool");
  const stpdUpdateButton = $(".btn-update-stpd");
  const msaUpdateButton = $(".btn-update-msa");
  const runFunctionButton = $(".btn-run-function");
  const { ACCOUNT } = window.variables;
  if (!ACCOUNT) {
    $(appPoolButton).html(`<button class="btn btn-big js-popup-open" href="#connect_wallet">Connect Wallet</button>`);
    $(stpdUpdateButton).html(`<button class="btn btn-big js-popup-open" href="#connect_wallet">Connect Wallet</button>`);
    $(msaUpdateButton).html(`<button class="btn btn-big js-popup-open" href="#connect_wallet">Connect Wallet</button>`);
    $(runFunctionButton).html(`<button class="btn btn-big js-popup-open" href="#connect_wallet">Connect Wallet</button>`);
    return;
  }

  $(appPoolButton).html(`<button class="btn btn-big" href="#add_pool">Add Pool</button>`);
  $(appPoolButton).children().click(onAddPool);

  $(stpdUpdateButton).html(`<button class="btn btn-big" href="#update_stpd">Update</button>`);
  $(stpdUpdateButton).children().click(onUpdateStpd);

  $(msaUpdateButton).html(`<button class="btn btn-big" href="#update_msa">Update</button>`);
  $(msaUpdateButton).children().click(onUpdateMsa);

  $(runFunctionButton).html(`<button class="btn btn-big" href="#run_function">Run Function</button>`);
  $(runFunctionButton).children().click(onRunFunction);

  if (ACCOUNT) {
    Promise.all([getPools()])
      .then(function ([pools]) {
        let availablePools = ''
        let disabledPools = ''
        pools.forEach(pool => {
          if (pool.maxStake > 0) {
            availablePools += pool.id + ', '
          } else {
            disabledPools += pool.id + ', '
          }
        })
        $(".admin-factory-stpd-form__pools-available").html(`<p>Available Pools : </p><p> ${availablePools}</p>`)
        $(".admin-factory-stpd-form__pools-disabled").html(`<p>Disabled Pools : </p><p> ${disabledPools}</p>`)
        $(".admin-factory-msa-form__pools-available").html(`<p>Available Pools : </p><p> ${availablePools}</p>`)
        $(".admin-factory-msa-form__pools-disabled").html(`<p>Disabled Pools : </p><p> ${disabledPools}</p>`)
      })
      .catch(console.log)
  }
}

function onAddPool() {
  const { ACCOUNT, FACTORY_CONTRACT } = window.variables;
  
  const token = $(".admin-factory-form__input-row[data-input='tokenAddress']");
  const secondaryTokenPerDay = $(".admin-factory-form__input-row[data-input='amount']");
  const maxStake = $(".admin-factory-form__input-row[data-input='maxAmount']");
  const tokenAddress = token.find("input").val();
  const secondaryTokenPerDayAmount = secondaryTokenPerDay.find("input").val();
  const maxStakeAmount = maxStake.find("input").val();
  // console.log(new BigNumber(secondaryTokenPerDayAmount).times(1e18).toString(10))

  if (!tokenAddress) {
    $(".admin-factory-form__notice").html('Please enter token address.');
    return;
  } else if (!toChecksumAddress(tokenAddress)) {
    $(".admin-factory-form__notice").html('Please enter valid token address.');
    return;
  }

  if (!secondaryTokenPerDayAmount) {
    $(".admin-factory-form__notice").html('Please enter the reward amount.');
    return;
  } else if (secondaryTokenPerDayAmount < 0) {
    $(".admin-factory-form__notice").html('Please enter the valid reward amount.');
    return;
  }

  if (!maxStakeAmount) {
    $(".admin-factory-form__notice").html('Please enter the max stake amount.');
    return;
  } else if (maxStakeAmount < 0) {
    $(".admin-factory-form__notice").html('Please enter the valid max stake amount.');
    return;
  }

  $(".admin-factory-form__notice").html('');

  send(FACTORY_CONTRACT.methods.add)(
    tokenAddress,
    new BigNumber(secondaryTokenPerDayAmount).times(1e18).toString(10),
    new BigNumber(maxStakeAmount).times(1e18).toString(10),
    {
      from: ACCOUNT,
    }
  )
    .send()
    .on("transactionHash", (hash) => {
      handleTransactionSuccess(hash);
      services.push({
        text: `Created new pool`,
        hash,
      });
    })
    .on("receipt", (receipt) => {
      services.update(receipt);
    })
    .on("error", (err, receipt) => {
      console.log("error :>> ", err);
      handleTransactionError();
      if (receipt) services.update(receipt);
    });
}

function onUpdateStpd() {
  const { ACCOUNT, FACTORY_CONTRACT } = window.variables;

  const pool = $(".admin-factory-form__input-row[data-input='poolid']");
  const secondaryTokenPerDay = $(".admin-factory-form__input-row[data-input='seconfaryTokenPerDay']");
  const poolId = pool.find("input").val();
  const secondaryTokenPerDayAmount = secondaryTokenPerDay.find("input").val();

  if (!poolId) {
    $(".admin-factory-stpd-form__notice").html('Please enter the pool id.');
    return;
  } else if (poolId < 0) {
    $(".admin-factory-stpd-form__notice").html('Please enter the valid pool id.');
    return;
  }

  if (!secondaryTokenPerDayAmount) {
    $(".admin-factory-stpd-form__notice").html('Please enter the reward amount.');
    return;
  } else if (secondaryTokenPerDayAmount < 0) {
    $(".admin-factory-stpd-form__notice").html('Please enter the valid reward amount.');
    return;
  }

  $(".admin-factory-stpd-form__notice").html('');

  send(FACTORY_CONTRACT.methods.setSecondaryTokensPerDay)(
    new BigNumber(poolId).toString(10),
    new BigNumber(secondaryTokenPerDayAmount).times(1e18).toString(10),
    {
      from: ACCOUNT,
    }
  )
    .send()
    .on("transactionHash", (hash) => {
      handleTransactionSuccess(hash);
      services.push({
        text: `Updated secondaryTokensPerDay to ${secondaryTokenPerDayAmount}`,
        hash,
      });
    })
    .on("receipt", (receipt) => {
      services.update(receipt);
    })
    .on("error", (err, receipt) => {
      console.log("error :>> ", err);
      handleTransactionError();
      if (receipt) services.update(receipt);
    });
}

function onUpdateMsa() {
  const { ACCOUNT, FACTORY_CONTRACT } = window.variables;

  const pool = $(".admin-factory-form__input-row[data-input='pid']");
  const maxStake = $(".admin-factory-form__input-row[data-input='maxStake']");
  const poolId = pool.find("input").val();
  const maxStakeAmount = maxStake.find("input").val();

  if (!poolId) {
    $(".admin-factory-msa-form__notice").html('Please enter the pool id.');
    return;
  } else if (poolId < 0) {
    $(".admin-factory-msa-form__notice").html('Please enter the valid pool id.');
    return;
  }

  if (!maxStakeAmount) {
    $(".admin-factory-msa-form__notice").html('Please enter the max stake amount.');
    return;
  } else if (maxStakeAmount < 0) {
    $(".admin-factory-msa-form__notice").html('Please enter the valid max stake amount.');
    return;
  }

  $(".admin-factory-msa-form__notice").html('');

  send(FACTORY_CONTRACT.methods.setMaxStake)(
    new BigNumber(poolId).toString(10),
    new BigNumber(maxStakeAmount).times(1e18).toString(10),
    {
      from: ACCOUNT,
    }
  )
    .send()
    .on("transactionHash", (hash) => {
      handleTransactionSuccess(hash);
      services.push({
        text: `Updated maxStake to ${maxStakeAmount}`,
        hash,
      });
    })
    .on("receipt", (receipt) => {
      services.update(receipt);
    })
    .on("error", (err, receipt) => {
      console.log("error :>> ", err);
      handleTransactionError();
      if (receipt) services.update(receipt);
    });
}

function onRunFunction() {
  const { ACCOUNT, SHARD_CONTRACT } = window.variables;

  const token = $(".admin-secondary-token-form__input-row[data-input='address']");
  const tokenAddress = token.find("input").val();
  const functionName = $("#admin-token-functions").val();
  // console.log(token)

  if (functionName !== 'renounceMinter' && functionName !== 'renounceCanTransfer') {
    if (!tokenAddress) {
      $(".admin-secondary-token-form__notice").html('Please enter token address.');
      return;
    } else if (!toChecksumAddress(tokenAddress)) {
      $(".admin-secondary-token-form__notice").html('Please enter valid token address.');
      return;
    }
  }

  if (functionName === 'renounceMinter' || functionName === 'renounceCanTransfer') {
    send(SHARD_CONTRACT.methods[functionName])(
      {
        from: ACCOUNT,
      }
    )
      .send()
      .on("transactionHash", (hash) => {
        handleTransactionSuccess(hash);
        services.push({
          text: `Run function ${functionName}`,
          hash,
        });
      })
      .on("receipt", (receipt) => {
        services.update(receipt);
      })
      .on("error", (err, receipt) => {
        console.log("error :>> ", err);
        handleTransactionError();
        if (receipt) services.update(receipt);
      });
  } else {
    send(SHARD_CONTRACT.methods[functionName])(
      tokenAddress,
      {
        from: ACCOUNT,
      }
    )
      .send()
      .on("transactionHash", (hash) => {
        handleTransactionSuccess(hash);
        services.push({
          text: `Run function ${functionName}`,
          hash,
        });
      })
      .on("receipt", (receipt) => {
        services.update(receipt);
      })
      .on("error", (err, receipt) => {
        console.log("error :>> ", err);
        handleTransactionError();
        if (receipt) services.update(receipt);
      });
  }
}

function clear() {
  $("#admin-token-token").val("");
  $("#admin-factory-amount").val("");
  $("#admin-factory-maxamount").val("");

  $("#admin-factory-token").val("");
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
