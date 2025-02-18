const { ethers } = require('hardhat');
const { tokens, assertRoughlyEquals } = require('./helpers.js');

const uniswapV2Factory = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const initcodeHashV2 = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f';
const oneInchLP1 = '0xbAF9A5d4b0052359326A6CDAb54BABAa3a3A9643';

describe('UniswapV3Oracle', function () {
    before(async function () {
        const UniswapV2LikeOracle = await ethers.getContractFactory('UniswapV2LikeOracle');
        const UniswapV3Oracle = await ethers.getContractFactory('UniswapV3Oracle');
        this.uniswapV2LikeOracle = await UniswapV2LikeOracle.deploy(uniswapV2Factory, initcodeHashV2);
        await this.uniswapV2LikeOracle.deployed();
        this.uniswapV3Oracle = await UniswapV3Oracle.deploy();
        await this.uniswapV3Oracle.deployed();
    });

    it('dai -> weth', async function () {
        await testRate(this, tokens.DAI, tokens.WETH, tokens.NONE);
    });

    it('weth -> dai', async function () {
        await testRate(this, tokens.WETH, tokens.DAI, tokens.NONE);
    });

    it('WETH -> USDT', async function () {
        await testRate(this, tokens.WETH, tokens.USDT, tokens.NONE);
    });

    it('USDT -> WETH', async function () {
        await testRate(this, tokens.USDT, tokens.WETH, tokens.NONE);
    });

    it('UNI -> WETH', async function () {
        await testRate(this, tokens.UNI, tokens.WETH, tokens.NONE);
    });

    it('WETH -> UNI', async function () {
        await testRate(this, tokens.WETH, tokens.UNI, tokens.NONE);
    });

    it('AAVE -> WETH', async function () {
        await testRate(this, tokens.AAVE, tokens.WETH, tokens.NONE);
    });

    it('WETH -> AAVE', async function () {
        await testRate(this, tokens.WETH, tokens.AAVE, tokens.NONE);
    });

    it('weth -> usdc -> dai', async function () {
        await testRate(this, tokens.WETH, tokens.DAI, tokens.USDC);
    });

    it('dai -> usdc -> weth', async function () {
        await testRate(this, tokens.DAI, tokens.WETH, tokens.USDC);
    });

    async function testRate (self, srcToken, dstToken, connector) {
        const v2Result = await self.uniswapV2LikeOracle.getRate(srcToken, dstToken, connector);
        const v3Result = await self.uniswapV3Oracle.getRate(srcToken, dstToken, connector);
        assertRoughlyEquals(v3Result.rate.toString(), v2Result.rate.toString(), 2);
    }
});

describe('UniswapV3Oracle doesn\'t ruin rates', function () {
    before(async function () {
        const UniswapV2LikeOracle = await ethers.getContractFactory('UniswapV2LikeOracle');
        const UniswapV3Oracle = await ethers.getContractFactory('UniswapV3Oracle');
        const UniswapOracle = await ethers.getContractFactory('UniswapOracle');
        const MooniswapOracle = await ethers.getContractFactory('MooniswapOracle');
        const MultiWrapper = await ethers.getContractFactory('MultiWrapper');
        const BaseCoinWrapper = await ethers.getContractFactory('BaseCoinWrapper');
        const AaveWrapperV1 = await ethers.getContractFactory('AaveWrapperV1');
        const AaveWrapperV2 = await ethers.getContractFactory('AaveWrapperV2');
        const OffchainOracle = await ethers.getContractFactory('OffchainOracle');

        this.uniswapV2LikeOracle = await UniswapV2LikeOracle.deploy(uniswapV2Factory, initcodeHashV2);
        await this.uniswapV2LikeOracle.deployed();
        this.uniswapV3Oracle = await UniswapV3Oracle.deploy();
        await this.uniswapV3Oracle.deployed();
        this.uniswapOracle = await UniswapOracle.deploy('0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95');
        await this.uniswapOracle.deployed();
        this.mooniswapOracle = await MooniswapOracle.deploy(oneInchLP1);
        await this.mooniswapOracle.deployed();

        this.wethWrapper = await BaseCoinWrapper.deploy(tokens.WETH);
        await this.wethWrapper.deployed();
        this.aaveWrapperV1 = await AaveWrapperV1.deploy();
        await this.aaveWrapperV1.deployed();
        this.aaveWrapperV2 = await AaveWrapperV2.deploy('0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');
        await this.aaveWrapperV2.deployed();
        await this.aaveWrapperV1.addMarkets([tokens.DAI]);
        await this.aaveWrapperV2.addMarkets([tokens.DAI]);
        this.multiWrapper = await MultiWrapper.deploy(
            [
                this.wethWrapper.address,
                this.aaveWrapperV1.address,
                this.aaveWrapperV2.address,
            ],
        );
        await this.multiWrapper.deployed();

        this.oldOffchainOracle = await OffchainOracle.deploy(
            this.multiWrapper.address,
            [
                this.uniswapV2LikeOracle.address,
                this.uniswapOracle.address,
                this.mooniswapOracle.address,
            ],
            [
                '0',
                '1',
                '2',
            ],
            [
                tokens.NONE,
                tokens.ETH,
                tokens.WETH,
                tokens.USDC,
                tokens.DAI,
            ],
            tokens.WETH,
        );
        await this.oldOffchainOracle.deployed();

        this.deployOffchainOracle = await OffchainOracle.deploy(
            this.multiWrapper.address,
            [
                this.uniswapV2LikeOracle.address,
                this.uniswapOracle.address,
                this.mooniswapOracle.address,
                this.uniswapV3Oracle.address,
            ],
            [
                '0',
                '1',
                '2',
                '0',
            ],
            [
                tokens.NONE,
                tokens.ETH,
                tokens.WETH,
                tokens.USDC,
                tokens.DAI,
            ],
            tokens.WETH,
        );
        await this.deployOffchainOracle.deployed();
    });

    it('ETH DAI', async function () {
        await testRate(this, tokens.ETH, tokens.DAI);
    });

    it('WETH DAI', async function () {
        await testRate(this, tokens.WETH, tokens.DAI);
    });

    it('USDC DAI', async function () {
        await testRate(this, tokens.USDC, tokens.DAI);
    });

    it('USDC WETH', async function () {
        await testRate(this, tokens.USDC, tokens.WETH);
    });

    async function testRate (self, srcToken, dstToken) {
        const expectedRate = await self.oldOffchainOracle.getRate(srcToken, dstToken, true);
        const actualRate = await self.deployOffchainOracle.getRate(srcToken, dstToken, true);
        const expectedReverseRate = await self.oldOffchainOracle.getRate(srcToken, dstToken, true);
        const actualReverseRate = await self.deployOffchainOracle.getRate(srcToken, dstToken, true);
        assertRoughlyEquals(actualRate.toString(), expectedRate.toString(), 2);
        assertRoughlyEquals(actualReverseRate.toString(), expectedReverseRate.toString(), 2);
    }
});
