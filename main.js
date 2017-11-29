/* TODO */
// catch errors thrown in the race

const fs = require('fs')
const path = require('path')
const bots = require('./bots')
const nitrohack = require('./nitrohack')

const stopTime = new Date((new Date()).getTime() + 58*60000) // (58 minutes)
const lastBreakTime = new Date((new Date()).getTime() - 90*60000).getTime() // (90 minutes)

function getRandomBot(){
	var choices = Object.keys(bots).filter(n => !bots[n].lastRace || bots[n].lastRace < lastBreakTime)
	var chosen = choices[Math.floor(Math.random()*choices.length)]
	bots[chosen].lastRace = Date.now()
	fs.writeFileSync(path.join(__dirname,'bots.json'),JSON.stringify(bots))
	return chosen
}

function getBots(){ 
	var users = process.argv.slice(2).filter(n => !n.match(/^-/))
	if(!users.length){
		users = [getRandomBot()]
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
