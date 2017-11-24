const WebSocket = require('ws')
const qs = require('qs')

const RECENT_BIAS = 0.3
const WPM = 31

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
			'force new connection': true,
			protocolVersion: 13,
			headers: {
				Cookie: racer.cookies.map(c => c.name + '=' + c.value).join('; ')
			}
		})
		// attach our listeners
		this.ws.onopen = () => this.onopen.call(this)
		this.ws.onmessage = data => this.onmessage.call(this, data)
		// create our instance of the race
		this.race = new Race(racer)
	}
	onopen() {
		// Tell their server that I want to race
		this.ws.send('4{"stream":"checkin","path":"/race","extra":{}}');
		this.ws.send('4' + JSON.stringify({
			stream: 'race',
			msg: 'join',
			payload: {
				debugging: false,
				avgSpeed: WPM,
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
				this.finish()
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
	finish(){
		this.ws.close()
		var bot = this.race.racers[this.race.bot.userID]
		this.callback(bot.name,bot.place,bot.money,Math.round(bot.LPMS*60000/5),bot.avgSpeed,bot.session,bot.totalRaces)
	}
}

class Race {
	constructor(racer) {
		this.bot = new Bot(racer)
		this.racers = {}
		this.racersArray = []
		this.textLength = 0
		this.racing = true
	}
	addRacer(racer) {
		var newRacer = new Racer(racer)
		console.log('adding',newRacer.name)
		this.racers[racer.userID] = newRacer
		this.racersArray.push(newRacer)
	}
	updateRacers(data) {
		data.racers.forEach(r => this.racers[r.u].update(r,data.secs))
		console.log(this.racersArray.map(r => Math.round(r.LPMS*60000/5)).join(' '))
//		console.log(this.bot.name)
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
	constructor(racer) {
		this.userID = racer.userID
		this.name = racer.username
		this.MAXLPMS =  (WPM*5/60000)*1.20
		this.MINLPMS =  (WPM*5/60000)*0.80
		this.LPMS = this.MINLPMS + Math.random()*(this.MAXLPMS - this.MINLPMS)
		this.nitrosUsed =  0
		this.skipped =  0
		this.accuracy =  90
		this.nStack = []
		this.position =  0
		this.errors = 0
	}
	getPosition(secs,canidates){
		var old = this.position
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
		var updateData = {
			t: this.position,
			e: numErrors? this.errors += numErrors : undefined,
			s: this.usedNitro ? this.skipped : undefined,
			n: this.usedNitro ? this.nitrosUsed : undefined,
		}
		this.usedNitro = false
		return updateData
	}
	getNumErrors(jump){
		if(jump <= 0 || isNaN(jump)){return 0}
		return [...Array(jump).keys()].reduce(e => e+Boolean(Math.floor(Math.random()*(100/this.accuracy))),0)
	}
	useNitro(jump){
		this.nitrosUsed++
		this.skipped += jump
		this.usedNitro = true
	}
	beatRandomPerson(canidates){
		// 		If we are following someone, and they haven't stopped
		if(this.following && canidates.length){
			// if they used a nitro
			if(this.following.usedNitro && this.nitrosUsed < 3){
				console.log('using a nitro like them',this.following.usedNitro)
				this.useNitro(this.following.usedNitro)
				this.following.usedNitro = 0
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