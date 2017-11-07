window.__nightmare = {};
__nightmare.ipc = require('electron').ipcRenderer;

var ws
var old = window.WebSocket
var fake = function(){
	ws = new old(...arguments)
	ws.addEventListener('message', onMessage)
	return ws
}
window.WebSocket = fake

var RecentBias = 0.3
window.userInfo = localStorage["A=2J6C"] && JSON.parse(decode(localStorage["A=2J6C"]).split('').reverse().join(''))
window.textLength = 0
window.racers = {}
window.me = {
	LPMS: (73*5/60000),
	MAXLPMS: (112*5/60000),
	nitrosUsed: 0,
	skipped: 0,
	accuracy: 97,
	nStack:[],
	position: 0,
	errors:0,
	eStack:[],
	flexMargin: 5
}

Array.prototype.avg = function(){
	return this.reduce((a,b) => a+b,0)/this.length
}
Array.prototype.pick = function(){
	return this[Math.floor(Math.random()*this.length)]
}

function addErrors(jump){
	if(jump <= 0 || isNaN(jump)){return}
	var randBool = chance => Boolean(Math.floor(Math.random()*(100/chance)))
	var numErrors = [...Array(jump).keys()].reduce(e => e+randBool(me.accuracy))
	if(numErrors){
		me.errors += numErrors
		me.hadError = true
	}
}

function useNitro(jump){
	++me.nitrosUsed
	me.skipped += jump
	me.usedNitro = true
}

function onMessage(e){
	var data = parseMessage(e.data)
	if(!data){
		return
	} else if(data.racers){
		var oldPosition = me.position
		// make all of our guesses
		updateRacers(data)
		var defaultSpeed = Math.round(me.LPMS*data.secs)
		// If our avgspeed is within 5wpm of our target, choose random
		var choice = (Math.abs(userInfo.avgSpeed - me.LPMS*60000/5)) >= me.flexMargin?beatClosestToTarget():beatRandomPerson()
//		console.log(Math.abs(userInfo.avgSpeed - me.LPMS*60000/5) >= me.flexMargin)
		me.position = choice || defaultSpeed
		// don't go over the end of the text, or faster than the max
		me.position = Math.min(me.position,textLength,Math.round(me.MAXLPMS*data.secs))
		// Also, don't go backwards
//		me.position = Math.max(me.position,oldPosition)
		// Throw some errors in there to look human
		addErrors(me.position - oldPosition)
		// send it to their server
		send()
		console.log(Object.values(racers).map(r => Math.round(r.LPMS*60000/5)).join(' '))
	} else if(data.l){
		textLength = data.l.length
	} else if(data.userID){
		console.log(data.userID+" "+(data.profile.displayName || data.profile.username))
	} else {
		console.log(data)
	}
}

function updateRacers(data){
	data.racers.forEach(r => {
		var car = racers[r.u] = racers[r.u] || {
			new:0,
			jumps:[],
			nStack:[],
		}
		car.old = car.new
		car.new = r.t || car.old
		car.LPMS = car.new/data.secs
		car.jumps.unshift(car.new - car.old)
		car.guess = Math.round(car.new + (car.jumps[0] * RecentBias) + (car.jumps.avg() * (1-RecentBias)))
		if(r.n){
			car.nStack.push(r.s-(car.nStack[0]||0))
		}
		if(r.r){
			car.done = true
			car.place = r.r.bonuses.place
			car.money = r.r.money
		}
	})
}

function getVaildOpponents(){
	return Object.keys(racers)
			.filter(id => id != userInfo.userID && 				 // not myself
										racers[id].new != textLength &&  // not already finished
										racers[id].jumps[0] != 0) 			 // they are moving
}

function beatRandomPerson(){
	var canidates = getVaildOpponents()
	//		 If we are following someone, and they haven't stopped
	if(me.following && canidates.length){
		// if they used a nitro
		if(racers[me.following].nStack.length && me.nitrosUsed < 3){
			console.log('using a nitro like them')
			useNitro(racers[me.following].nStack.shift())
		}
		// go a couple letters ahead of where we think they are going to be
		return racers[me.following].guess+2
	// if we aren't following someone
	} else if(canidates.length){
		// choose someone to follow
		me.following = canidates.pick()
		console.log("following:",me.following)
	}
	return false
}

function beatClosestToTarget(){
	var canidates = getVaildOpponents()
	var dist = id => Math.abs(me.LPMS - racers[id].LPMS)
	//		 If we are following someone, and they haven't stopped
	if(me.following && canidates.length){
		// if they used a nitro
		if(racers[me.following].nStack.length && me.nitrosUsed < 3){
			console.log('using a nitro like them')
			useNitro(racers[me.following].nStack.shift())
		}
		// go a couple letters ahead of where we think they are going to be
		return racers[me.following].guess+2
	// if we aren't following someone
	} else if(canidates.length && me.position > textLength*0.2){
		// choose someone to follow
		me.following = canidates.sort((a,b) => dist(a) - dist(b))[0]
		console.log("following:",me.following)
	}
	return false
}

function alwaysWin(){
	var fastest = Object.keys(racers)
						.filter(id => id != userInfo.userID)
						.reduce((f,id) => Math.max(f,racers[id].guess||0),0)
	// Skip last part
	if(fastest > textLength*0.9)
		return textLength
	return fastest && fastest+5
}

function send(showErrors){
	ws.send(4+JSON.stringify({
		stream:'race',
		msg:'update',
		payload:{
			t:me.position,
			e:me.hadError && me.errors,
			s:me.usedNitro && me.skipped,
			n:me.usedNitro && me.nitrosUsed,
		}
	}))
	me.usedNitro = undefined
	me.hadError = undefined
}

function parseMessage(m){
	var parsed
	try{
		parsed = JSON.parse(m.slice(1)).payload
	} catch(e){
		return false
	}
	return parsed
}

// ROTn.js
////////////////////////////////////////////////
// (C) 2010 Andreas  Spindler. Permission to use, copy,  modify, and distribute
// this software and  its documentation for any purpose with  or without fee is
// hereby  granted.   Redistributions of  source  code  must  retain the  above
// copyright notice and the following disclaimer.
//
// THE SOFTWARE  IS PROVIDED  "AS IS" AND  THE AUTHOR DISCLAIMS  ALL WARRANTIES
// WITH  REGARD   TO  THIS  SOFTWARE   INCLUDING  ALL  IMPLIED   WARRANTIES  OF
// MERCHANTABILITY AND FITNESS.  IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
// SPECIAL,  DIRECT,   INDIRECT,  OR  CONSEQUENTIAL  DAMAGES   OR  ANY  DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
// OF  CONTRACT, NEGLIGENCE  OR OTHER  TORTIOUS ACTION,  ARISING OUT  OF  OR IN
// CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
// 
// $Writestamp: 2010-06-09 13:07:07$
// $Maintained at: www.visualco.de$

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

function decode(text){
  var map = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~"
  return ROTn(text,map).split('').reverse().join('')
}