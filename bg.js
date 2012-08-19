// Global hard-coded settings
DEBUG = false;
TIMER_FREQUENCY = (DEBUG ? 3 : 5); // seconds
DEBUG_LOG = [];
LAUNCH_TIMESTAMP = parseFloat((new Date).getTime()/1000.0);
IDLE_TIME = (DEBUG ? 15 : 5 * 60);


// Global containers of all ManaBar objects
ManaBars = {
	"Global": new ManaBar({"name": "Global"}),
};
ActiveManaBarNames = [];


// !CORE LOGIC

function mainTimer()
{
	var currentUrl = localStorage['currentUrl'];
	var currentTimestamp = parseFloat((new Date).getTime()/1000.0);
	var lastTimestamp = parseFloat(localStorage['lastTimestamp']) || currentTimestamp;

	$.each(ManaBars, function(n, mb)
	{
		var isActive = ($.inArray(mb.name, ActiveManaBarNames) != -1);
	
		// TODO: Determine idle quantity, which is when cooldown begins, not ends
		// For now, hardcoding to 5 minutes
		
		chrome.idle.queryState(IDLE_TIME, function(state)
		{
			mb.tick(currentUrl, isActive, state, currentTimestamp, lastTimestamp);

			//var d = new Date(currentTimestamp);
			//debugMsg("<b>URL</b>: "+current_url+" (Tab #"+localStorage['current_tab']+")");
			//debugMsg("<b>Mana</b>: "+mb.mana()+" / "+mb.maxTime+" ("+mb.status+")", true);
			//debugMsg("<b>Timestamp</b>: "+d.getHours()+':'+d.getMinutes()+':'+d.getSeconds());
			//debugMsg("<b><small>"+ACTION_LOG.join("</small></b><br><b><small>")+"</small></b>");
			//ACTION_LOG = [];
		});
	});

	localStorage['lastTimestamp'] = currentTimestamp;
}
setInterval(mainTimer, TIMER_FREQUENCY * 1000);


function firstRun()
{
	// TODO: Run main timer logic as if time had elapsed since last launch

/*
	var currentUrl = localStorage['currentUrl'];
	var currentTimestamp = parseFloat((new Date).getTime());
	var lastTimestamp = parseFloat(localStorage['lastTimestamp']) || currentTimestamp;
	var elapsed = parseFloat(currentTimestamp - lastTimestamp);

	$.each(ManaBars, function(n, mb)
	{
		var isActive = $.inArray(mb.name, ActiveManaBarNames);

		mb.tick(currentUrl, isActive, 'active', currentTimestamp, lastTimestamp);
	});

	localStorage['lastTimestamp'] = currentTimestamp;
*/
}



function getManaBarsForUrl(url)
{
	var barList = [];

	if(url.indexOf("chrome-devtools") != -1
	|| url.indexOf("chrome-extension") != -1
	|| url.indexOf("chrome:") != -1) return [];

	// Extract the domain from our provided URL
	var matches = url.match(/https?:\/\/([^\/]*)\/.*/)
	if(!matches || matches.length < 2) return [];
	var urlDomain = matches[1];

	$.each(ManaBars, function(name, mb)
	{
		// For now, only one manabar per URL
		if(barList.length > 0) return false;
	
		// Whitelist means the manabar only affects the specified domains; otherwise,
		// the manabar affects everything *except* the specified domains
	
		var useWhiteList = (mb.name == "Global" ? false : true);
		var rejectManaBar = false; // used by blacklist if we find a negative match
	
		var filterDomains = mb.filterDomains;
		if(!filterDomains)
		{
			if(!useWhiteList) barList.push(name);
			return true; // continue
		}
	
		var domains = filterDomains.split(/[,\s]+/);
		$.each(domains, function(name, domain)
		{
			// If we are using a blacklist, it means that we are excluding only the filtered domains;
			// a whitelist means we exclude everything *except* the filtered domains.
			
			// direct match
			if(domain == urlDomain)
			{
				if(useWhiteList) barList.push(name);
				else rejectManaBar = true;
				return false;
			}
				
			// check for subdomains
			if(domain.indexOf("*") == -1)
			{	var regex = new RegExp("/.+\."+domain+"/", "i");
				if(regex.test(urlDomain))
				{
					if(useWhiteList) barList.push(name);
					else rejectManaBar = true;
					return false;
				}
			}
			
			// wildcard-based match, if *'s are present
			else
			{	var regex = new RegExp("/"+domain.replace("*", ".*")+"/", "i");
				if(regex.test(urlDomain))
				{
					if(useWhiteList) barList.push(name);
					else rejectManaBar = true;
					return false;
				}
			}
		});

		// Blacklist found a match, so bounce to the next manabar
		if(rejectManaBar) return true;

		// Otherwise, all domains are affected, unless we had already caught a match above
		if(!useWhiteList) barList.push(name);
	});

	return barList;
}





function updateUrl(url, tabId)
{
	//console.log("updateUrl: "+tabId+" "+url);
 
	// Update the current front page Url value
	localStorage['currentUrl'] = url;
	localStorage['currentTab'] = tabId;

	ActiveManaBarNames = getManaBarsForUrl(url);

	//	localStorage['lastActivity'] = (new Date()).getTime();
}


function pageLoading(url, tabId)
{
	var currentTimestamp = parseFloat((new Date).getTime()/1000.0);

	// We ignore page loads during the first 10 (?) seconds of launch;
	// re-spawning previous tabs shouldn't count.
	if(currentTimestamp - LAUNCH_TIMESTAMP < 10.0) return;

	var manaBars = getManaBarsForUrl(url);
	$.each(ActiveManaBarNames, function(n, manaBarName)
	{
		var mb = ManaBars[manaBarName];
		if(mb) mb.click(url, currentTimestamp);
	});
}


function pageComplete(url, tabId)
{
	// As of now, we don't need to do anything with this event
}




// ! 
// !EVENT CALLBACKS


// ! tabs.onUpdated
// ----------------
// Fires when a tab changes URL or status ("loading" or "complete").

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab)
{
	//console.log(tab.status+" "+tab.url+" // "+changeInfo.status+" "+changeInfo.url);

	updateUrl(tab.url, tabId);
	
	if(changeInfo.status == "loading") // should this be "complete" instead?
	{
		pageLoading(tab.url, tabId);
	}
	else // if(changeInfo.status == "complete")
	{
		pageComplete(tab.url, tabId);
	}
});


// ! tabs.onCreated
// ----------------
// Fires when a tab is created.

if(false) // don't think we need this
chrome.tabs.onCreated.addListener(function(tab)
{
	//console.log("onCreated"); // removeInfo.isWindowClosing
});


// ! tabs.onRemoved
// ----------------
// Fires when a tab is closed.

if(false) // don't think we need this
chrome.tabs.onRemoved.addListener(function(tabId, removeInfo)
{
	//console.log("onRemoved"); // removeInfo.isWindowClosing
});



// ! tabs.onSelectionChanged
// -------------------------
// Fires when the selected tab in a window changes.

chrome.tabs.onSelectionChanged.addListener(function(tabId, selectInfo)
{
	//console.log("onSelectionChanged"); // selectInfo.windowId
	
	chrome.tabs.get(tabId, function(tab)
	{
		updateUrl(tab.url, tab.id);
	});
});



// ! windows.onFocusChanged
// ------------------------
// Fired when the currently focused window changes.
// Will be chrome.windows.WINDOW_ID_NONE if all chrome windows have lost focus.

chrome.windows.onFocusChanged.addListener(function(windowId)
{
	//console.log("onFocusChanged");

	if(windowId > 0)
	chrome.windows.get(windowId, {populate: true}, function(win)
	{
		var tabs = win.tabs;
		for(var i in tabs)
		{
			if(!tabs[i].active) continue;
			
			updateUrl(tabs[i].url, tabs[i].id);
		}
	});
	
	else
	{
		//console.log("idle");
		
	}

	// Grr, I should be able to do this instead:
	
	/*
	chrome.tabs.getCurrent(function(tab)
	{
		updateUrl(tab.url);
	});
	*/
});


// ! idle.onStateChanged
// ------------------------
// Fired when resuming from idle

chrome.idle.onStateChanged.addListener(function(newState)
{
	if(newState == "active")
	{
/*
		var status = localStorage['status'];
		switch(status)
		{
			case 'lockout':
				break;

			case 'cooling':
				break;

			case 'draining':
				break;

			case 'recharging':
				break;
		}
*/
	}
	
	else if(newState == "idle")
	{
		// not yet supported by Chrome
	}
});



// Will not work in incognito
//chrome.history.onVisited.addListener(function(visit)
//{
//});





// ! 
// !USER INTERFACE


/*
function updateManaBar(which)
{
	if(which == undefined) which = "Global";

	//var canvas = $('<canvas id="canvas" width="19" height="19"></canvas>')[0];
	var canvas = document.getElementById('canvas');
	if(!canvas)
	{
		$('body').append('<canvas id="canvas" width="19" height="19"></canvas>');
		canvas = document.getElementById('canvas');
	}

	var canvasWidth = canvas.width;
	var canvasHeight = canvas.height;
	var context = canvas.getContext('2d');
	
	// Clear drawing area
	context.clearRect(0, 0, canvasWidth, canvasHeight);

	// Calculate bar width and percentage
	var mana = getMana(which);
	var total = getOption("maxtime", which);
	var fraction = parseFloat(mana) / parseFloat(total);
	var offsetX = 0;
	var barWidth = parseInt(canvasWidth * fraction);
	var barHeight = 9; //parseInt(canvasHeight);

	// Draw!
	context.fillStyle = "rgba(0,0,2000,255)";
	context.fillRect(offsetX, 0, barWidth, barHeight);

	chrome.browserAction.setBadgeText({"text":parseInt(fraction*100)+"%"});
	
	// Set background color based on status: draining, recharging, or idle
	var status = localStorage["status"];
	if(status == "draining")
		chrome.browserAction.setBadgeBackgroundColor({"color": "#FF0000"});
	else if(status == "charging")
		chrome.browserAction.setBadgeBackgroundColor({"color": "#00FF00"});
	else if(status == "cooling")
		chrome.browserAction.setBadgeBackgroundColor({"color": "#0000FF"});
	
	var imageData = context.getImageData(0, 0, canvas.width, canvas.height);

	chrome.browserAction.setIcon({"imageData": imageData});
}
*/


/*
function doIfNotIdle(seconds, fn)
{
	if(seconds == undefined)
		seconds = 600;
	
	chrome.idle.queryState(seconds, function(state)
	{
		if(state == "active" && typeof fn == 'function')
			fn();
	});
}
*/


/*
function checkForMana(warning)
{
	if(warning == undefined) warning = false;
}
*/


function outOfManaPage(tabId)
{
	// temp
	//return;

	chrome.tabs.insertCSS(parseInt(tabId), {"code":
		"#Out_Of_Mana { "
	+		"position: fixed; width: 100%; height: 100%; padding-top: 40%; "
	+		"text-align: center; background: gray; opacity: 0.8; z-index: 999999; "
	+	"}"
	+	"#Out_Of_Mana > span { "
	+		"display: inline-block; border-radius: 20px; padding: 15px 25px;"
	+		"background: black; color: white; font-weight: bold; font-size: 40px;"
	+	"}"
	}, function(){});
	
	chrome.tabs.executeScript(parseInt(tabId), {"code":
		"if(!document.getElementById('Out_Of_Mana')) "
	+	"document.body.innerHTML += '<div id=\"Out_Of_Mana\"><span>You are out of mana.<span></div>';"
	+	"if(typeof window.stop == 'function') window.stop();"
	}, function(){ });
}


function removeOutOfManaPage()
{
	chrome.tabs.executeScript(parseInt(tabId), {"code":
		"var Out_Of_Mana = document.getElementById('Out_Of_Mana');"
	+	"if(Out_Of_Mana) Out_Of_Mana.parentNode.removeChild(Out_Of_Mana);"
	}, function(){  });
}


function issueWarning(tabId)
{
	// todo
	return;

	chrome.tabs.insertCSS(parseInt(tabId), {"code":
		"#Out_Of_Mana_Warning { "
	+		"position: fixed; width: 100%; height: 50px; top: -50px; padding: 0px; "
	+		"text-align: center; background: gray; opacity: 0.8; z-index: 999999; "
//	+		"-webkit-animation: "
	+	"}"
	+	"#Out_Of_Mana > span { "
	+		"display: inline-block; padding: 15px 25px;"
	+		"background: black; color: white; font-weight: bold; font-size: 20px;"
	+	"}"
	}, function(){});


}


function debugLog(msg)
{
	console.log(msg);

	if(DEBUG && DEBUG_LOG)
		DEBUG_LOG.push(msg);
}

// Inject a debug box onto the current page
function debugMsg(msg, clear)
{
	if(!DEBUG) return;
	
	if(clear == undefined) clear = false;

	var currentTab = parseInt(localStorage['currentTab']);

	if(currentTab)
	chrome.tabs.get(currentTab, function(tab)
	{
		if(tab.url.indexOf("chrome-devtools") != -1 || tab.url.indexOf("chrome:") != -1) return;
		
		chrome.tabs.insertCSS(parseInt(currentTab), {"code":
			"#webmana_debug { "
		+		"position: fixed; top: 5px; left: 5px; z-index: 10000; padding: 5px 10px; opacity: 0.6; "
		+		"font-size: 12px; font-family: sans-serif; "
		+		"background: black; color: white; border: white; box-shadow: 0px 0px 10px #888; "
		+	"}"
		+	"#webmana_debug p { margin: 0.4em 0; }"
		+	"#webmana_debug p b { font-weight: bold !important; }"
		});
		
		chrome.tabs.executeScript(parseInt(currentTab), {"code":
			'var debugbox = document.getElementById("webmana_debug");'
		+	'if(!debugbox) { '
		+		'document.body.innerHTML += \'<div id="webmana_debug"></div>\';'
		+		'debugbox = document.getElementById("webmana_debug");'
		+	'} '
		+	'if(debugbox) debugbox.innerHTML '+(clear ? '=' : '+=')+' "<p>'+msg.replace('"', '\\"')+'</p>";'
		});			
	});
}


function drainAll()
{
	$.each(ManaBars, function(name, mb)
	{
		mb.mana(0.0);
	})
}


function debugRecharge()
{
	if(!DEBUG) return;
	
	$.each(ManaBars, function(name, mb)
	{
		mb.mana(mb.maxTime);
	})
}
debugRecharge();