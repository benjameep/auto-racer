/* TODO */
// On unexpected connection close, still callback

const WebSocket = require('ws')
const qs = require('qs')

const RECENT_BIAS = 0.3

const myBots = require('./racers.json').map(b => b.userID)

Array.prototype.avg = function () {
	return this.reduce((a, b) => a + b, 0) / this.length
}
Array.prototype.pick = function () {
	return this[Math.floor(Math.random() * this.length)]
}

module.exports.race = function(bot,cb){
	new WsHandler(bot,cb)
}

class WsHandler {
	constructor(racer,callback) {
		this.callback = callback
		// open the websocket
		this.ws = new WebSocket('wss://realtime3.nitrotype.com/realtime/?' + qs.stringify({
			_primuscb: Date.now() + '-0',
			EIO: 3,
			transport: 'websocket',
			t: Date.now(),
			b64: 1,
		}), {
			origin: 'https://www.nitrotype.com',
			host: 'realtime2.nitrotype.com',
			protocolVersion: 13,
			headers: {
				Cookie: racer.cookies.map(c => c.name + '=' + c.value).join('; ')
			}
		})
		// attach our listeners
		this.ws.onopen = () => this.onopen.call(this)
		this.ws.onmessage = data => this.onmessage.call(this, data)
		this.ws.onclose = data => this.onclose.call(this, data)
		this.WPM = racer.cookies.filter(c => c.name == '2G8DA665')[0].value
		// create our instance of the race
		this.race = new Race(racer,this.WPM,() => this.quit.call(this))
	}
	onopen() {
		// Tell their server that I want to race
		this.ws.send('4{"stream":"checkin","path":"/race","extra":{}}');
		this.ws.send('4' + JSON.stringify({
			stream: 'race',
			msg: 'join',
			payload: {
				debugging: false,
				avgSpeed: this.WPM,
				track: 'arctic',
				music: 'standard',
				update: 3417
			}
		}))
	}
	onmessage(data) {
		// parse the weirdly formatted data
		data = this.parseMessage(data)
		if (!data) {
			// this discards the message if it dosen't have a payload or something
			return;
		}
		if (data.speeds) {
			// add the racers who where there before us
			data.racers.forEach(this.race.addRacer)
		} else if (data.secs) {
			// got an update of racers' positions
			this.race.updateRacers(data)
			this.send(this.race.getMyPosition(data.secs))
			// check if we finished
			if(this.race.racers[this.race.bot.userID].done)
				this.ws.close()
		} else if(data.l){
			// got the lesson text
			this.race.bot.textLength = data.l.length
		} else if(data.userID){
			// adding another racer
			this.race.addRacer(data)
		} else {
			// starting the race
			console.log(this.race.racersArray.map(r => r.name).join(' | '))
		}
	}
	onclose(data){
		console.log('closing')
		var bot = this.race.racers[this.race.bot.userID]
		if(bot){
			this.callback(bot.name,bot.place,Math.round(bot.LPMS*60000/5)+'['+bot.avgSpeed+']',bot.session+'['+bot.totalRaces+']',"$"+bot.money,new Date().toLocaleTimeString())
		} else {
			this.callback('Error: wasClean',data.wasClean,data.reason)
		}
	}
	send(payload){
		if(this.ws.readyState != 1)
			return
		this.ws.send(4+JSON.stringify({
			stream:'race',
			msg:'update',
			payload:payload
		}))
	}
	parseMessage(m) {
		var parsed
		try {
			parsed = JSON.parse(m.data.slice(1)).payload
		} catch (e) {
			return false
		}
		return parsed
	}
	quit(err){
		this.ws.close()
	}
}

class Race {
	constructor(racer,WPM,quit) {
		this.quit = quit
		this.bot = new Bot(racer,WPM)
		this.racers = {}
		this.racersArray = []
		this.textLength = 0
		this.racing = true
	}
	addRacer(racer,emergencySwitch) {
		// if we happened to run into one of our own bots, just quit
		if(myBots.includes(racer.userID) && this.bot.userID != racer.userID){
			console.log('ran into',racer.userID)
			this.quit()
		}
		var newRacer = new Racer(racer)
		process.stdout.write('adding '+newRacer.name+'           \r')
		this.racers[racer.userID] = newRacer
		this.racersArray.push(newRacer)
	}
	updateRacers(data) {
		data.racers.forEach(r => this.racers[r.u].update(r,data.secs))
		process.stdout.write(this.racersArray.map(r => Math.round(r.LPMS*60000/5)).join(' ')+' '+this.bot.name+'           \r')
	}
	getMyPosition(secs) {
		return this.bot.getPosition(secs,this.getValidOpponents())
	}
	getValidOpponents(){
		return this.racersArray.filter(opponent => 
											opponent.userID != this.bot.userID && // not myself
											!opponent.done &&  										// not already finished
											opponent.jumps[0] != 0) 			 				// they are moving
	}
}

class Bot {
	constructor(racer,WPM) {
		var distributedRandom = s => s/5*Math.pow((2*Math.random()-1),3)+s
		var lpms = (WPM*5/60000)
		this.userID = racer.userID
		this.name = racer.username
		this.MAXLPMS =  lpms*1.20
		this.MINLPMS =  lpms*0.80
		this.LPMS = distributedRandom(lpms)
		this.nitrosUsed =  0
		this.skipped =  0
		this.accuracy =  95
		this.nStack = []
		this.position =  0
		this.errors = 0
	}
	getPosition(secs,canidates){
		var old = this.position
		this.usedNitro = false
		
		this.position = /*this.beatRandomPerson(canidates) ||*/ this.LPMS*secs
		
		// don't go past the end, or faster than our max
		this.position = Math.min(this.position,this.textLength,this.MAXLPMS*secs)
		
		// don't go slower than our min
		this.position = Math.max(this.position,this.MINLPMS*secs)
		
		// can't have typed a fraction of a letter
		this.position = Math.round(this.position)
		
		// cause all humans make mistakes
		var numErrors = this.getNumErrors(this.position - old)
		this.errors += numErrors
		
		// occasionally use nitro even if the person we are following (if any) dosen't use one
		this.calcUseNitro()
		
		return {
			t: this.position,
			e: numErrors? this.errors += numErrors : undefined,
			s: this.usedNitro ? this.skipped : undefined,
			n: this.usedNitro ? this.nitrosUsed : undefined,
		}
	}
	getNumErrors(jump){
		if(jump <= 0 || isNaN(jump)){return 0}
		return [...Array(jump).keys()].reduce(e => e+Boolean(Math.floor(Math.random()*(100/this.accuracy))),0)
	}
	useNitro(jump){
		if(this.nitrosUsed < 3){
			this.nitrosUsed++
			this.skipped += jump
			this.usedNitro = true
		}
	}
	calcUseNitro(){
		if(Math.floor(Math.random()*100) == 72){ // if it chooses my favorite number
			this.useNitro(4)
			this.position += 4
		} 
	}
	beatRandomPerson(canidates){
		// 		If we are following someone, and they haven't stopped
		if(this.following && canidates.length){
			// if they used a nitro
			if(this.following.usedNitro){
				console.log('using a nitro like them',this.following.usedNitro)
				this.useNitro(this.following.usedNitro)
				this.following.usedNitro = false
			}
			// go a couple letters ahead of where we think they are going to be
			return this.following.guess+2
		// if we aren't following someone but we have the option to
		} else if(canidates.length){
			// choose someone to follow
			this.following = canidates.pick()
			console.log('following:',this.following.name)
		}
		return false
	}
}

class Racer{
	constructor(r){
		var p = r.profile
		this.userID = r.userID,
		this.name = (p.tag ? `[${p.tag}]` : '') + (p.displayName || p.username)
		this.session = p.sessionRaces
		this.totalRaces = p.racesPlayed
		this.level = p.level
		this.avgSpeed = p.avgSpeed
		this.jumps = []
		this.nStack = []
	}
	getPlace(n){
		return {
					"2200": "1st",
					"2090": "2nd",
					"1980": "3rd",
					"1870": "4th",
					"1760": "5th",
				}[n]
	}
	update(r,secs){
		this.old = this.new || 0
		this.new = r.t || this.old
		this.LPMS = this.new / secs
		this.jumps.unshift(this.new - this.old)
		this.guess = Math.round(this.new + (this.jumps[0] * RECENT_BIAS) + (this.jumps.avg() * (1 - RECENT_BIAS)))
		if (r.n) { // if used a nitro
			this.usedNitro = r.s - (this.nStack[this.nStack.length-1] || 0)
			this.nStack.push(r.s)
		}
		if (r.r){ // if finished the race
			this.done = true
			this.place = this.getPlace(r.r.bonuses.place)
			this.money = r.r.money
		}
	}
}