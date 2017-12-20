const ntapi = require('./ntapi-wrapper')
const async = require('async')

Array.prototype.pick = function(){
	return this[Math.floor(Math.random() * this.length)]
};

async function joinTeams(){
	await ntapi.forEach(async bot => {
		let teamInvites = await bot.getTeamInvites()
		let team = teamInvites.pick()
		if(team){
			try{
				await bot.acceptTeamInvite(team.teamID)
				 
			} catch(e){
				console.log(e)
			}
		}
	});
}

function subtleReplace(str){
	let swap = (str,swap) => str.replace(new RegExp(swap.split('').map(n => "^$/.*+?|()[]{}\\".includes(n)?'\\'+n:n).join('|'),'g'),$0 => swap[(swap.indexOf($0)+1)%swap.length])
	let brackets = str => swap(swap(str,'[({'),'])}')
	let nums = str =>  str.split('').reverse().join('').replace(/\d/,$0 => {let r = Math.floor(Math.random()*9);return r==$0?9:r}).split('').reverse().join('')
	let swaps = ['S$','-_','|/\\','\'"','.,']
	let funcs = [nums,brackets].concat(swaps.map(s => str => swap(str,s)))
	let i = 0
	while (str == funcs[i](str) && i < funcs.length - 1){i++}
	return i < funcs.length - 1 && funcs[i](str)
}

async function getLotsOfDisplayNames(){
	let teams = await ntapi.searchTeams('minLevel',8,Math.floor(Math.random()*100))
	let promises = teams.map(async t => (await ntapi.team(t.tag)))
	teams = await Promise.all(promises)
	let names = teams.reduce((a,t) => a.concat(t.members.map(m => m.displayName)),[]).filter(n => n)
	return names.map(subtleReplace).filter(n => n)
}

async function updateSettings(){
	const displayNames = await getLotsOfDisplayNames()
	await ntapi.forEach(async bot => {
		const settings = await bot.getSettings()
		const d = await bot.setSettings({
			displayName: bot.level >= 8?displayNames.pick():'',
			country: bot.country || 'US',
			gender: bot.gender || ['male','female'].pick(),
			title: Object.keys(settings.titles).slice(-5).pick()
		}).catch(console.log)
	})
}

async function buyCar(){
	await ntapi.forEach(async bot => {
		var cars = await bot.getAffordableCars()
		cars = cars.sort((a,b) => b.carID - a.carID).slice(0,10)
		var chosen = cars.pick()
		console.log(`${bot.username} is buying ${chosen.name}`)
		await bot.buyCar(chosen.carID).catch(console.log)
	})
}

async function useCar(prefs){
	await ntapi.forEach(async bot => {
		var cars = bot.cars.map(c => c[0]).sort((a,b) => prefs.indexOf(b) - prefs.indexOf(a))
		await bot.useCar(cars[0])
	})
}


(async () => {
	await ntapi.all.login()
	await ntapi.all.check()
	await updateSettings()
	await joinTeams()
	await buyCar()
	await useCar([69,111,142,72,143,135])
})()
