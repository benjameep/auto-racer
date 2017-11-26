/* TODO */
// catch errors thrown in the race

const fs = require('fs')
const path = require('path')
const updateCookies = require('./updateCookies')
const nitrohack = require('./nitrohack')

const stopTime = new Date((new Date()).getTime() + 58*60000) // (58 minutes)

function getBots(){ 
	var users = process.argv.slice(2).filter(n => !n.match(/^-/))
	if(!users.length){
		var now = new Date()
		var i = (now.getHours()%6)*4+(now.getMinutes()/15|0)
		users = [require('./racers')[i].username]
	}
	return updateCookies.get(users)
}

function main(){
	var bots = getBots()
	console.log(bots.map(b => b.userID))
	bots.forEach((bot) => raceLoop(bot))
}

function raceLoop(bot){
	nitrohack.race(bot,function(){
		fs.appendFileSync(path.join(__dirname,'races.log'),[...arguments].join(' ')+'\n')
		if(Date.now() < stopTime)
			raceLoop(bot)
	})
}

main()
