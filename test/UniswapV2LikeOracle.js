const { ethers } = require('hardhat');
const { expect, ether } = require('@1inch/solidity-utils');
const { tokens } = require('./helpers.js');

const uniswapV2 = {
    factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    initcodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
};
const shibaswap = {
    factory: '0x115934131916c8b277dd010ee02de363c09d037c',
    initcodeHash: '0x65d1a3b1e46c6e4f1be1ad5f99ef14dc488ae0549dc97db9b30afe2241ce1c7a',
};

describe('UniswapV2LikeOracle', function () {
    before(async function () {
        const UniswapV2LikeOracle = await ethers.getContractFactory('UniswapV2LikeOracle');
        this.uniswapV2LikeOracle = await UniswapV2LikeOracle.deploy(uniswapV2.factory, uniswapV2.initcodeHash);
        await this.uniswapV2LikeOracle.deployed();
        this.shibaswapOracle = await UniswapV2LikeOracle.deploy(shibaswap.factory, shibaswap.initcodeHash);
        await this.shibaswapOracle.deployed();
    });

    it('uniswapV2 weth -> dai', async function () {
        const rate = await this.uniswapV2LikeOracle.getRate(tokens.WETH, tokens.DAI, tokens.NONE);
        expect(rate.rate).to.gt(ether('1000'));
    });

    it('uniswapV2 weth -> usdc -> dai', async function () {
        const rate = await this.uniswapV2LikeOracle.getRate(tokens.WETH, tokens.DAI, tokens.USDC);
        expect(rate.rate).to.gt(ether('1000'));
    });

    it('shibaswap weth -> dai', async function () {
        const rate = await this.shibaswapOracle.getRate(tokens.WETH, tokens.DAI, tokens.NONE);
        expect(rate.rate).to.gt(ether('1000'));
    });

    it('shibaswap weth -> usdc -> dai', async function () {
        const rate = await this.shibaswapOracle.getRate(tokens.WETH, tokens.DAI, tokens.USDC);
        expect(rate.rate).to.gt(ether('1000'));
    });
});
