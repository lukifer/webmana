
function ManaBar(args)
{
	if(args == undefined) args = {};
	this.name = (args.name == undefined ? 'Global' : args.name);
	this.status = "cooling";

	var defaults = {
		"maxTime": 60 * 60, // seconds
		"coolDown": 15 * 60, // seconds
		"clickCost": 15, //seconds
		"rechargeRate": 0.2,
		"hardcore": false,
		"warning": 5 * 60, // seconds
		"filterDomains": "",
	};

	// my settings for real-world testing
	defaults = {
		"maxTime": 60 * 60, // seconds
		"coolDown": 5 * 60, // seconds
		"clickCost": 15, //seconds
		"rechargeRate": 1.0,
		"hardcore": false,
		"warning": 5 * 60, // seconds
		"filterDomains": "stackoverflow.com, zeptojs.com, jquery.com, wordpress.org, developer.chrome.com, github.com",
	};

	if(DEBUG) args = {
		"maxTime": 2 * 60, // seconds
		"coolDown": 15, // seconds
		"clickCost": 10,
		"rechargeRate": 5.0,
		"warning": 30, // seconds
		"filterDomains": "stackoverflow.com, zeptojs.com, developer.chrome.com",
	};

	$.extend(this, defaults, args);
	
	this.mana = function(val)
	{
		var name = this.name;

		// Get
		if(val == undefined)
		{
			var mana = localStorage['webmana_'+name];
			if(mana == undefined)
				localStorage['webmana_'+name] = mana = this.maxTime;
				
			return parseFloat(mana);
		}
		
		// Set
		else
		{
			localStorage['webmana_'+name] = parseFloat(val);
		}
	};

	// First Run boundary checking
	if(this.mana() > this.maxTime) this.mana(parseFloat(this.maxTime));
	if(this.mana() < 0.0) this.mana(0.0);


	this.lastActivity = function(val)
	{
		var name = this.name;

		// Get
		if(val == undefined)
		{
			var lastActivity = localStorage['webmana_'+name+'_lastActivity'];
			if(lastActivity == undefined)
				localStorage['webmana_'+name+'_lastActivity'] = lastActivity = 0.0;
				
			return parseFloat(lastActivity);
		}
		
		// Set
		else
		{
			debugLog("-- ACTIVITY --");
			localStorage['webmana_'+name+'_lastActivity'] = parseFloat(val);
		}
	};

	
	// Timer has elapsed
	this.tick = function(currentUrl, isActive, state, currentTimestamp, lastTimestamp)
	{
		var mana = this.mana();
		var rechargeRate = parseFloat(this.rechargeRate);
		var maxTime = parseFloat(this.maxTime);
		var coolDown = parseInt(this.coolDown);
		
		
		debugLog("===== "+state+" / "+this.status);
		

		if(state == "idle" || this.status == "lockout")
		{
			if(!coolDown || currentTimestamp - parseFloat(this.lastActivity()) > (coolDown + IDLE_TIME))
			{
				this.recharge(mana, currentTimestamp - lastTimestamp);
			}
			
			else debugLog(((coolDown + IDLE_TIME) - (currentTimestamp - parseFloat(this.lastActivity())))
				+ " seconds remain in COOLDOWN");
		}
		
		else // state == "active"
		{
			// ManaBar is affecting the current tab & URL

			if(isActive) // && state == "active"
			{
				this.drain(mana, currentTimestamp - lastTimestamp);
			}
			

			// ManaBar is sleeping: current tab & URL do not affect it
			
			else
			{
				// More time has elapsed than the cooldown value
				if(!coolDown || currentTimestamp - parseFloat(this.lastActivity()) > (coolDown + IDLE_TIME))
				{
					this.recharge(mana, currentTimestamp - lastTimestamp);
				}
				
				// Still cooling
				else
				{
					debugLog(((coolDown + IDLE_TIME) - (currentTimestamp - parseFloat(this.lastActivity())))
						+ " seconds remain in COOLDOWN (2)");

					if(this.status != 'cooling') debugLog("COOLING STARTED");
					this.status = 'cooling';
				}
			}
		}
		
		this.paintIcon();
	};
	
	
	// User has done one of the following: change tabs, clicked a link, etc
	this.click = function(url, currentTimestamp)
	{
		// Charge the click cost, if there is one
		if(this.clickCost > 0)
		{
			var newMana = parseFloat(this.mana()) - parseFloat(this.clickCost);
			if(newMana < 0.0) newMana = 0.0;
			this.mana(newMana);
			this.paintIcon();
		}

		this.lastActivity(currentTimestamp);

		debugLog("Page load drain of "+parseFloat(this.clickCost));
	};


	this.recharge = function(mana, elapsed)
	{
		// Increase based on elapsed time and recharge rate
		mana += parseFloat(elapsed * this.rechargeRate);
	
		// Bounds checking
		if(mana > this.maxTime) mana = parseFloat(this.maxTime);
	
		this.mana(mana);
		this.status = 'charging';
	
		debugLog(this.name+" RECHARGED by "+parseFloat(elapsed * this.rechargeRate));
	};
	
	
	this.drain = function(mana, elapsed)
	{
		mana -= parseFloat(elapsed);
		
		if(mana <= 0.0)
		{
			mana = 0.0;
		}
		
		this.mana(mana);
		
		if(mana > 0.0)
		{
			this.status = 'draining';

			debugLog(this.name+" DRAINED by "+elapsed);
			
			if(mana < this.warning && mana > (this.warning - TIMER_FREQUENCY))
				issueWarning(localStorage['currentTab']);
		}
		
		else
		{
			if(this.status != 'lockout')
				outOfManaPage(localStorage['currentTab']);

			this.status = 'lockout';

			debugLog(this.name+" LOCKOUT");
		}
	};
	
	
	// Draw this mana bar
	this.paintIcon = function(options)
	{
		// Unpack options
		if(options == undefined) options = {};
		var returnImageData = (options.returnImageData == undefined ? false : !!options.returnImageData);
		var textOverlay = (options.textOverlay == undefined ? true : !!options.textOverlay);
		var barStyle = (options.barStyle == undefined ? "bar" : options.barStyle);

		// Get canvas from DOM, creating if necessary
		var name = this.name;
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
		var mana = this.mana();
		var total = this.maxTime;
		var fraction = parseFloat(mana) / parseFloat(total);
		var offsetX = 0;
		var barWidth = parseInt(canvasWidth * fraction);
		var barHeight = 9; //parseInt(canvasHeight);
	
		// Draw!
		switch(barStyle)
		{
			case "circle": // todo
				break;
		
			case "bar":
			default:
				context.fillStyle = "rgba(0,0,2000,255)";
				context.fillRect(offsetX, 0, barWidth, barHeight);
				break;
		}
	
		if(textOverlay)
		{
			chrome.browserAction.setBadgeText({"text":parseInt(fraction*100)+"%"});
		
			// Set background color based on status: draining, recharging, or idle
			var status = this.status;
			if(status == "draining")
				chrome.browserAction.setBadgeBackgroundColor({"color": "#DD0000"});
			else if(status == "charging")
				chrome.browserAction.setBadgeBackgroundColor({"color": "#00CC00"});
			else if(status == "cooling")
				chrome.browserAction.setBadgeBackgroundColor({"color": "#0000EE"});
			
			if(!returnImageData)
				chrome.browserAction.setTitle({"title": status.charAt(0).toUpperCase() + status.substring(1)});
		}
		else if(!returnImageData)
			chrome.browserAction.setTitle({"title": parseInt(fraction*100)+"%"});
		
		// Retrieve image data, and either draw or return
		var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	
		if(returnImageData)
			return imageData;
		else
			chrome.browserAction.setIcon({"imageData": imageData});
	};


	return this;
}

// !End ManaBar



