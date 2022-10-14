# HyperPerk embed project

# 1. How to use library

## Load scripts
https://code.jquery.com/jquery-3.5.1.min.js
https://cdnjs.cloudflare.com/ajax/libs/bignumber.js/8.0.2/bignumber.min.js
https://unpkg.com/web3@1.3.1/dist/web3.min.js
https://unpkg.com/web3modal@1.9.3/dist/index.js
https://unpkg.com/evm-chains@0.2.0/dist/umd/index.min.js
https://unpkg.com/@walletconnect/web3-provider@1.3.1/dist/umd/index.min.js

/index.js
/constants.js
/stake.js

## Load stylesheets
/main.css

## Render Stake Form
Add empty div with class `stake-embed` to your code.
```
<div class="stake-embed"></div>
```

Stake Form will be rendered automatically.
--------------

# Build
yarn gulp

# Caution
This library will be worked in platform using real dom.
If your project using virtual dom like reactjs or vuejs, please use iframe.
