const Web3 = require('web3');
const utils = require('web3-utils');
const Abi = require('web3-eth-abi')
const v2pairAbi = require('@liuxingfeiyu/zoo-core/build/abi/IUniswapV2Pair.json')





// 全局Swap配置
const PairMap = {
	"0x407f7a2f61e5bab199f7b9de0ca330527175da93" : {
		Pair :"ETH-USDT",
		SwapName:"Cherry",
		targetDecimal: 18, //ETH decimals
		archorDecimal: 18, //USDT decimals
		archorTokenIndex: 0 //indicate archor token is token0 or token1
	}
}




// 获取Swap交易额
// 参数
// @web3 web3结构
// @blockNo 区块
// @swapPairAddr swap pair 地址
// @accountAddr 对应账号地址
// Return
// 总交易额
async function fetchSwapExchangeVolumes(web3,blockNo,swapPairAddr,accountAddr) {
	const block = await web3.eth.getBlock(blockNo,true)
	let totalVolumesInUsdt = 0

	for (var index in block.transactions){
		const res = await fetchSwapExchangeVolumesByReceipt(web3,block.transactions[index],swapPairAddr,accountAddr)
		totalVolumesInUsdt += res
	}
	return totalVolumesInUsdt

}


async function fetchSwapExchangeVolumesByReceipt(web3,trans,swapPairAddr,accountAddr) {
	const { hash } = trans
	trans.receipt = await web3.eth.getTransactionReceipt(hash)
	let totalVolumesInUsdt = 0
	if (trans.receipt && trans.receipt.logs) {
	    trans.receipt.logs.forEach((eventlog, logIndex) => {
		const { address } = eventlog
		// 过滤对应swap pair
		if (address.toLocaleLowerCase() == swapPairAddr.toLocaleLowerCase()) {
		    const log = convertEvent(eventlog, v2pairAbi)
		    if (log.topics == "Swap") {
			const { amount0In, amount1In, amount0Out, amount1Out,to  } = log.args
			//过滤对应账户
			if (to.toLocaleLowerCase() == accountAddr.toLocaleLowerCase()){
				let dir, amount, price,volumes
				const pairInfo = PairMap[address.toLocaleLowerCase()]
				const [archorIn, targetIn, archorOut, targetOut] = (pairInfo.archorTokenIndex == 0) ? [amount0In, amount1In, amount0Out, amount1Out] : [amount1In, amount0In, amount1Out, amount0Out]
				const decimalRatio = Math.pow(10, pairInfo.archorDecimal - pairInfo.targetDecimal)
				if (parseFloat(archorIn) > 0) {
					dir = "buy"
					amount = parseFloat(targetOut) / Math.pow(10, pairInfo.targetDecimal)
					price = parseFloat(archorIn) / parseFloat(targetOut) / decimalRatio
					volumes = amount*price
				} else {
					dir = "sell"
					amount = parseFloat(targetIn) / Math.pow(10, pairInfo.targetDecimal)
					price = parseFloat(archorOut) / parseFloat(targetIn) / decimalRatio
					volumes = amount*price
				}
				console.log("Fech account swap record ",{ hash,to, dir, amount, price ,volumes})
				totalVolumesInUsdt += volumes
			}
		    }
		}
	    })
	}
	return totalVolumesInUsdt

}




function convertEvent(log, abi) {
	var findAbi = abi.find(function (r) {
		if (r.type == "event") {
			let funcName = utils._jsonInterfaceMethodToString(r);
			let sig = Abi.encodeEventSignature(funcName)
			return sig == log.topics[0]
		}
		return false
	})

	if (findAbi) {
		const { data, topics, ...rest } = log
		if (!findAbi.anonymous) {
			log.topics = log.topics.slice(1)
		}
		let args = Abi.decodeLog(findAbi.inputs, log.data, log.topics)
		let res = { topics: findAbi.name, args: args, ...rest }
		return res
	} else {
		return ""
	}

}


async function fetchSwapVolumesDemo(){
	const blockNo1 = 5887884
	const blockNo2 = 5888700
	const SwapAddr = "0x407f7a2f61e5bab199f7b9de0ca330527175da93"
	const MyAccountAddr = "0x576DaE38769d5fa2A8eaA709c35D0f24BC8bc523"
	const provider = "https://exchainrpc.okex.org"
	const web3 = new Web3(new Web3.providers.HttpProvider(provider));

	//Swap ETH->USDT
	{
		const blockNo = blockNo1 
		const totalVolumesInUsdt = await fetchSwapExchangeVolumes(web3, blockNo, SwapAddr, MyAccountAddr)
		console.log("For ", PairMap[SwapAddr].Pair, " In ", PairMap[SwapAddr].SwapName, " At block ", blockNo, " totalVolumes is ", totalVolumesInUsdt)
	}

	//Swap USDT->ETH
	{
		const blockNo = blockNo2 
		const totalVolumesInUsdt = await fetchSwapExchangeVolumes(web3, blockNo, SwapAddr, MyAccountAddr)
		console.log("For ", PairMap[SwapAddr].Pair, " In ", PairMap[SwapAddr].SwapName, " At block ", blockNo, " totalVolumes is ", totalVolumesInUsdt)
	}
}

fetchSwapVolumesDemo()