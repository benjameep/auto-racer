var Nightmare = require('nightmare')
require('night-map')(Nightmare)
var nightmare
var fs = require('fs')
var racers = require('./racers')

function getNeeded(){
	return racers.filter(racer => !racer.cookies || !racer.cookies.filter(c => c.expir).every(c => c.expir > Date.now()))
}

function get(users){
	var needed = getNeeded()
	var ourRacerNames = racers.map(r => r.username)
	users = users || ourRacerNames
	if(needed.some(r => users.includes(r.username))){
		// if one of the requested user's cookies have expired
		throw needed + 'cookies\' have expired'
	} else if(needed.length){
		console.log('Warning:',needed,'cookies\' have expired')
	}
	var unknownNames = users.filter(user => !ourRacerNames.includes(user))
	if(unknownNames.length){
		// they requested a user we don't have
		throw 'We don\'t have any information on ' + unknownNames
	}
	// give them the racers they requested
	return racers.filter(r => users.includes(r.username))
}

function main(cb){
	var needed = getNeeded()
	if(needed.length){
		console.log('getting cookies for',needed.map(r => r.username))
		getCookies(needed,() => {
			fs.writeFileSync('racers.json',JSON.stringify(racers))
			cb(racers)
		})
	} else {
		cb(racers)
	}
}

function getCookies(racers, cb) {
	nightmare = new Nightmare({show:true})
	nightmare
		.map(getInfo, racers)
		.then(newRacers => {
			console.log(newRacers)
			return nightmare.end()
		})
		.then(cb)
		.catch(console.error)
}

function getInfo(racer) {
	return nightmare
		.goto('https://www.nitrotype.com')
		.evaluate(() => $('.log-out').click())
		.wait('.login-link')
		.click('.login-link')
		.insert('[name=username]', racer.username)
		.insert('[name=password]', racer.password)
		.click('.login-form .submit')
		.wait(3000)
		.wait(() => $('.racer-info').length || $('#username-error').length || $('#password-error').length)
		.evaluate(() => {
			function ROTn(text, map) {
				// Generic ROT-n algorithm for keycodes in MAP.
				var R = new String()
				var i, j, c, len = map.length
				for (i = 0; i < text.length; i++) {
					c = text.charAt(i)
					j = map.indexOf(c)
					if (j >= 0) {
						c = map.charAt((j + len / 2) % len)
					}
					R = R + c
				}
				return R;
			}

			function decode(text) {
				var map = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~"
				return ROTn(text, map)
			}
			return JSON.parse(decode(localStorage["A=2J6C"])).userID
		})
		.then(userID => {
			racer.userID = userID
			return nightmare.cookies.get()
		})
		.then(cookies => {
			racer.cookies = cookies.filter(c => !c.name.match(/^_/)).map(c => ({
				name:c.name,
				value:c.value,
				expir: c.expirationDate && Date.now() + c.expirationDate
			}))
			return racer
		})
}

module.exports.get = get

if (require.main === module) {
	main(() => {})
}