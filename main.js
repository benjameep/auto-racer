/* TODO */
// catch errors thrown in the race

const fs = require('fs')
const path = require('path')
const bots = require('./bots')
const nitrohack = require('./nitrohack')

const stopTime = new Date((new Date()).getTime() + 58*60000) // (58 minutes)
const lastBreakTime = new Date((new Date()).getTime() - 90*60000) // (90 minutes)

function getRandomBot(){
	bots.filter(bot => !bot.lastRace || bot.lastRace < )
}

function getBots(){ 
	var users = process.argv.slice(2).filter(n => !n.match(/^-/))
	if(!users.length){
		
		var now = new Date()
		var i = (now.getHours()%8)*3+(now.getMinutes()/20|0)
		users = [Object.keys(bots)[i]]
	}
	return users.map(name => bots[name])
}

function raceLoop(bot){
	nitrohack.race(bot,function(){
		fs.appendFileSync(path.join(__dirname,'races.log'),[...arguments].join(' ')+'\n')
		if(Date.now() < stopTime)
			raceLoop(bot)
	})
}


getBots().forEach(raceLoop)
