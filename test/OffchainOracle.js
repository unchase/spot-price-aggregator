const { ether, BN } = require('@openzeppelin/test-helpers');
const { expect, assertRoughlyEqualValues } = require('@1inch/solidity-utils');
const { tokens, assertRoughlyEquals } = require('./helpers.js');

const uniswapV2Factory = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const initcodeHash = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f';
const oneInchLP1 = '0xbAF9A5d4b0052359326A6CDAb54BABAa3a3A9643';

const BaseCoinWrapper = artifacts.require('BaseCoinWrapper');
const UniswapV2LikeOracle = artifacts.require('UniswapV2LikeOracle');
const UniswapOracle = artifacts.require('UniswapOracle');
const MooniswapOracle = artifacts.require('MooniswapOracle');
const OffchainOracle = artifacts.require('OffchainOracle');
const AaveWrapperV1 = artifacts.require('AaveWrapperV1');
const AaveWrapperV2 = artifacts.require('AaveWrapperV2');
const MultiWrapper = artifacts.require('MultiWrapper');
const GasEstimator = artifacts.require('GasEstimator');

const ADAIV2 = '0x028171bCA77440897B824Ca71D1c56caC55b68A3';

describe('OffchainOracle', async function () {
    before(async function () {
        this.uniswapV2LikeOracle = await UniswapV2LikeOracle.new(uniswapV2Factory, initcodeHash);
        this.uniswapOracle = await UniswapOracle.new('0xc0a47dFe034B400B47bDaD5FecDa2621de6c4d95');
        this.mooniswapOracle = await MooniswapOracle.new(oneInchLP1);

        this.wethWrapper = await BaseCoinWrapper.new(tokens.WETH);
        this.aaveWrapperV1 = await AaveWrapperV1.new();
        this.aaveWrapperV2 = await AaveWrapperV2.new('0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9');
        await this.aaveWrapperV1.addMarkets([tokens.DAI]);
        await this.aaveWrapperV2.addMarkets([tokens.DAI]);
        this.multiWrapper = await MultiWrapper.new(
            [
                this.wethWrapper.address,
                this.aaveWrapperV1.address,
                this.aaveWrapperV2.address,
            ],
        );

        this.expensiveConnectors = [
            ...Object.values(tokens).slice(0, 10),
        ];
        this.expensiveOffachinOracle = await OffchainOracle.new(
            this.multiWrapper.address,
            [
                this.uniswapV2LikeOracle.address,
                this.uniswapOracle.address,
                this.mooniswapOracle.address,
            ],
            [
                (new BN('2')).toString(),
                (new BN('2')).toString(),
                (new BN('2')).toString(),
            ],
            this.expensiveConnectors,
            tokens.WETH,
        );
        this.gasEstimator = await GasEstimator.new();
    });

    beforeEach(async function () {
        this.connectors = [
            tokens.NONE,
            tokens.ETH,
            tokens.WETH,
            tokens.USDC,
        ];
        this.offchainOracle = await OffchainOracle.new(
            this.multiWrapper.address,
            [
                this.uniswapV2LikeOracle.address,
                this.uniswapOracle.address,
                this.mooniswapOracle.address,
            ],
            [
                (new BN('2')).toString(),
                (new BN('2')).toString(),
                (new BN('2')).toString(),
            ],
            this.connectors,
            tokens.WETH,
        );
    });

    it('weth -> dai', async function () {
        const rate = await this.offchainOracle.getRate(tokens.WETH, tokens.DAI, true);
        console.log(rate.toString());
        expect(rate).to.be.bignumber.greaterThan(ether('1000'));
    });

    it('eth -> dai', async function () {
        const rate = await this.offchainOracle.getRate(tokens.ETH, tokens.DAI, true);
        console.log(rate.toString());
        expect(rate).to.be.bignumber.greaterThan(ether('1000'));
    });

    it('usdc -> dai', async function () {
        const rate = await this.offchainOracle.getRate(tokens.USDC, tokens.DAI, true);
        console.log(rate.toString());
        expect(rate).to.be.bignumber.greaterThan(ether('980000000000'));
    });

    it('dai -> adai', async function () {
        const rate = await this.offchainOracle.getRate(tokens.DAI, ADAIV2, true);
        expect(rate).to.be.bignumber.equal(ether('1'));
    });

    it('getRate(dai -> link)_GasCheck', async function () {
        const result = await this.gasEstimator.gasCost(this.expensiveOffachinOracle.address, this.expensiveOffachinOracle.contract.methods.getRate(tokens.DAI, tokens.LINK, true).encodeABI());
        assertRoughlyEquals(result.gasUsed, '685574', 3);
    });

    it('getRateToEth(dai)_ShouldHaveCorrectRate', async function () {
        const expectedRate = await this.offchainOracle.getRate(tokens.DAI, tokens.WETH, true);
        const actualRate = await this.offchainOracle.getRateToEth(tokens.DAI, true);
        assertRoughlyEquals(expectedRate, actualRate, 3);
    });

    it('getRateToEth(dai)_GasCheck', async function () {
        const result = await this.gasEstimator.gasCost(this.expensiveOffachinOracle.address, this.expensiveOffachinOracle.contract.methods.getRateToEth(tokens.DAI, true).encodeABI());
        assertRoughlyEquals(result.gasUsed, '952380', 3);
    });

    it('getRateDirect(dai -> link)_ShouldHaveCorrectRate', async function () {
        const expectedRate = await this.offchainOracle.getRate(tokens.DAI, tokens.LINK, true);
        const actualRate = await this.offchainOracle.getRate(tokens.DAI, tokens.LINK, false);
        assertRoughlyEquals(expectedRate, actualRate, 3);
    });

    it('getRateDirect(dai -> link)_GasCheck', async function () {
        const result = await this.gasEstimator.gasCost(this.expensiveOffachinOracle.address, this.expensiveOffachinOracle.contract.methods.getRate(tokens.DAI, tokens.LINK, false).encodeABI());
        assertRoughlyEquals(result.gasUsed, '357919', 2);
    });

    describe('customConnectors', async function () {
        beforeEach(async function () {
            for (const connector of this.connectors) {
                await this.offchainOracle.removeConnector(connector);
            }
        });

        it('weth -> dai', async function () {
            const rateWithCustomConnector = await this.offchainOracle.getRate(tokens.WETH, tokens.DAI, true, this.connectors);
            for (const connector of this.connectors) {
                await this.offchainOracle.addConnector(connector);
            }
            const rate = await this.offchainOracle.getRate(tokens.WETH, tokens.DAI, true);
            expect(rateWithCustomConnector).to.be.bignumber.greaterThan(ether('1000'));
            assertRoughlyEqualValues(rateWithCustomConnector, rate, 1e-18);
        });

        it('eth -> dai', async function () {
            const rateWithCustomConnector = await this.offchainOracle.getRate(tokens.ETH, tokens.DAI, true, this.connectors);
            for (const connector of this.connectors) {
                await this.offchainOracle.addConnector(connector);
            }
            const rate = await this.offchainOracle.getRate(tokens.ETH, tokens.DAI, true);
            expect(rateWithCustomConnector).to.be.bignumber.greaterThan(ether('1000'));
            assertRoughlyEqualValues(rateWithCustomConnector, rate, 1e-18);
        });

        it('usdc -> dai', async function () {
            const rateWithCustomConnector = await this.offchainOracle.getRate(tokens.USDC, tokens.DAI, true, this.connectors);
            for (const connector of this.connectors) {
                await this.offchainOracle.addConnector(connector);
            }
            const rate = await this.offchainOracle.getRate(tokens.USDC, tokens.DAI, true);
            expect(rateWithCustomConnector).to.be.bignumber.greaterThan(ether('980000000000'));
            assertRoughlyEqualValues(rateWithCustomConnector, rate, 1e-18);
        });

        it('dai -> adai', async function () {
            const rateWithCustomConnector = await this.offchainOracle.getRate(tokens.DAI, ADAIV2, true, this.connectors);
            for (const connector of this.connectors) {
                await this.offchainOracle.addConnector(connector);
            }
            const rate = await this.offchainOracle.getRate(tokens.DAI, ADAIV2, true);
            expect(rateWithCustomConnector).to.be.bignumber.equal(ether('1'));
            assertRoughlyEqualValues(rateWithCustomConnector, rate, 1e-18);
        });
    });
});
