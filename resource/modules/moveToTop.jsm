moduleAid.VERSION = '1.6.7';

this.__defineGetter__('mainWindow', function() { return $('main-window'); });
this.__defineGetter__('gBrowser', function() { return window.gBrowser; });
this.__defineGetter__('browser', function() { return $('browser'); });
this.__defineGetter__('appcontent', function() { return $('appcontent'); });

this.moveTopStyle = {};
this.lwthemeImage = null;

this.findBarMaxHeight = 0;

// until I find a better way of finding out on which side of the browser is the scrollbar, I'm setting equal margins
this.__defineGetter__('MIN_LEFT', function() { return 22; });
this.__defineGetter__('MIN_RIGHT', function() { return 22; });
this.lastTopStyle = null;

this.shouldReMoveTop = function(newStyle) {
	if(!lastTopStyle) { return true; }
	
	if(!newStyle) {
		if(isPDFJS) {
			var loadingBar = contentDocument.getElementById('loadingBar');
			loadingBar = (loadingBar && loadingBar.clientHeight > 0);
			if(loadingBar != lastTopStyle.PDFJSloadingBar) { return true; }
		}
		return (gFindBar.clientWidth != lastTopStyle.clientWidth);
	}
	else if(newStyle.top != lastTopStyle.top
		|| newStyle.right != lastTopStyle.right
		|| newStyle.left != lastTopStyle.left
		|| newStyle.maxWidth != lastTopStyle.maxWidth
		|| newStyle.clientWidth != lastTopStyle.clientWidth
		|| newStyle.movetoRight != lastTopStyle.movetoRight) {
			return true;
	}
	
	return false;
};

this.browserPanelResized = function() {
	timerAid.init('browserPanelResized', function() {
		dispatch(browserPanel, { type: 'browserPanelResized', cancelable: false });
	}, 0);
};

this.delayMoveTop = function() {
	timerAid.init('delayMoveTop', moveTop, 0);
};

this.moveTopAsNeeded = function(e) {
	if(shouldReMoveTop()) {
		if(e.type == 'FindBarUIChanged') {
			moveTop();
		} else {
			delayMoveTop();
		}
	}
};

this.containerPDFResize = function(e) {
	if(!inPDFJS(e.target.document)) { return; }
	delayMoveTop();
};

this.fixFindBarPosition = function() {
	if(!onTopFB) { return; }
	
	// Bug 893446 sets these properties to relative and absolute, causing the findbar to jump around when toggling it.
	gFindBar.style.position = '';
	gFindBar.parentNode.style.position = '';
				
	// Bug 893446 sets gFindBar.style.height incorrectly, we don't need this when we're using this feature
	gFindBar.style.height = '';
	
	// Bug 893446 scrolls the content when toggling the findbar, this is of course not necessary as well with this feature
	gFindBar._contentScrollOffset = 0;
};

// Handles the position of the findbar
this.moveTop = function() {
	// always move it at least once to prevent the initial hangup
	if(lastTopStyle) {
		if((!viewSource && !gFindBarInitialized) || gFindBar.hidden) { return; } // no need to move it again if it's hidden, the stylesheet should remain valid
	} else if(!viewSource) {
		gFindBar; // make sure the find bar is initialized past this point
	}
	
	// The textbox maxWidth code should be removed, so we have an accurate size of the find bar here
	dispatch(gFindBar, { type: 'FindBarMaybeMoveTop', cancelable: false });
	
	fixFindBarPosition();
	
	moveTopStyle = {
		marginTop: null,
		movetoRight: prefAid.movetoRight,
		maxWidth: -MIN_RIGHT -MIN_LEFT,
		clientWidth: gFindBar.clientWidth,
		left: MIN_LEFT,
		right: MIN_RIGHT,
		PDFJSloadingBar: false,
		top: -1 // Move the find bar one pixel up so it covers the toolbox borders, giving it a more seamless look
	};
	
	var appContentPos = $('content').getBoundingClientRect();
	moveTopStyle.maxWidth += appContentPos.width;
	moveTopStyle.top += appContentPos.top;
	moveTopStyle.left += appContentPos.left;
	moveTopStyle.right += document.documentElement.clientWidth -appContentPos.right;
	
	// Compatibility with TreeStyleTab
	if($('TabsToolbar') && !$('TabsToolbar').collapsed) {
		// This is also needed when the tabs are on the left, the width of the findbar doesn't follow with the rest of the window for some reason
		if($('TabsToolbar').getAttribute('treestyletab-tabbar-position') == 'left' || $('TabsToolbar').getAttribute('treestyletab-tabbar-position') == 'right') {
			var TabsToolbar = $('TabsToolbar');
			var TabsSplitter = document.getAnonymousElementByAttribute($('content'), 'class', 'treestyletab-splitter');
			moveTopStyle.maxWidth -= TabsToolbar.clientWidth;
			moveTopStyle.maxWidth -= TabsSplitter.clientWidth +(TabsSplitter.clientLeft *2);
			if(!prefAid.movetoRight && TabsToolbar.getAttribute('treestyletab-tabbar-position') == 'left') {
				moveTopStyle.left += TabsToolbar.clientWidth;
				moveTopStyle.left += TabsSplitter.clientWidth +(TabsSplitter.clientLeft *2);
			}
			if(prefAid.movetoRight && TabsToolbar.getAttribute('treestyletab-tabbar-position') == 'right') {
				moveTopStyle.right += TabsToolbar.clientWidth;
				moveTopStyle.right += TabsSplitter.clientWidth +(TabsSplitter.clientLeft *2);
			}
		}
	}
	
	// Compatibility with PDF.JS
	if(isPDFJS) {
		var toolbar = contentDocument.getElementById('toolbarViewer');
		if(toolbar) {
			moveTopStyle.top += toolbar.clientHeight;
			var outerContainer = contentDocument.getElementById('outerContainer');
			var sidebarContainer = contentDocument.getElementById('sidebarContainer');
			if(outerContainer.classList.contains('sidebarOpen')) {
				moveTopStyle.left += sidebarContainer.clientWidth;
			}
			var loadingBar = contentDocument.getElementById('loadingBar');
			if(loadingBar && loadingBar.clientHeight) {
				moveTopStyle.top += loadingBar.clientHeight;
				moveTopStyle.PDFJSloadingBar = true;
				
				// don't cover the loading bar
				moveTopStyle.top++;
				
				// Make sure we move the find bar back to its place when the loading bar is hidden
				timerAid.init('moveTopPDFJSLoadingBar', function() {
					try {
						if(loadingBar.clientHeight == 0) {
							timerAid.cancel('moveTopPDFJSLoadingBar');
							moveTopAsNeeded({ type: 'FindBarUIChanged' });
						}
					}
					catch(ex) {
						timerAid.cancel('moveTopPDFJSLoadingBar');
					}
				}, 50, 'slack');
			}
			listenerAid.add(contentDocument.defaultView, 'resize', containerPDFResize, true);
		}
	}
	
	toggleAttribute(gFindBar, 'inPDFJS', (isPDFJS && toolbar));
	toggleNotificationState();
	
	if(!shouldReMoveTop(moveTopStyle)) {
		dispatch(gFindBar, { type: 'FindBarMovedTop', cancelable: false });
		return;
	}
	
	lastTopStyle = moveTopStyle;
	
	// Unload current stylesheet if it's been loaded
	styleAid.unload('topFindBar_'+_UUID);
	styleAid.unload('topFindBarCorners_'+_UUID);
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop] {\n';
	sscode += '		max-width: ' + Math.max(moveTopStyle.maxWidth, 5) + 'px !important;\n';
	// Bug 893446 sets left and right values to 0, so we need to overwrite them
	if(!prefAid.movetoRight) {
		sscode += '	left: ' + moveTopStyle.left + 'px !important;\n';
		sscode += '	right: auto !important;\n';
	} else {
		sscode += '	right: ' + moveTopStyle.right + 'px !important;\n';
		sscode += '	left: auto !important;\n';
	}
	sscode += '		top: ' + moveTopStyle.top + 'px !important;\n';
	sscode += '		bottom: auto !important;\n';
	sscode += '	}';
	sscode += '}';
	
	styleAid.load('topFindBar_'+_UUID, sscode, true);
	
	dispatch(gFindBar, { type: 'FindBarMovedTop', cancelable: false });
	
	moveTopCorners();
	if(!viewSource) { findPersonaPosition(); }
	
	// Doing it aSync prevents the window elements from jumping at startup (stylesheet not loaded yet)
	aSync(function() { setOnTop(); });
};

this.moveTopCorners = function() {
	// We also need to properly place the corners, these vary with OS, FF version, theme...
	var barStyle = getComputedStyle(gFindBar);
	var baseCornerWidth = 16;
	var container = gFindBar.getElement('findbar-container');
	
	if(barStyle.getPropertyValue('direction') == 'ltr') {
		var findBarPaddingStart = parseInt(barStyle.getPropertyValue('padding-left'));
		var findBarPaddingEnd = parseInt(barStyle.getPropertyValue('padding-right'));
		var findBarBorderStart = parseInt(barStyle.getPropertyValue('border-left-width'));
		var findBarBorderEnd = parseInt(barStyle.getPropertyValue('border-right-width'));
	} else {
		var findBarPaddingStart = parseInt(barStyle.getPropertyValue('padding-right'));
		var findBarPaddingEnd = parseInt(barStyle.getPropertyValue('padding-left'));
		var findBarBorderStart = parseInt(barStyle.getPropertyValue('border-right-width'));
		var findBarBorderEnd = parseInt(barStyle.getPropertyValue('border-left-width'));
	}
	
	var beforeStart = -baseCornerWidth -findBarPaddingStart -(findBarBorderStart -1);
	var afterStart = gFindBar.clientWidth -container.clientWidth -findBarPaddingEnd +(findBarBorderEnd -1);
	
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:before { -moz-margin-start: ' + beforeStart + 'px !important; }\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:after { -moz-margin-start: ' + afterStart + 'px !important; }\n';
	sscode += '}';
	
	styleAid.load('topFindBarCorners_'+_UUID, sscode, true);
	
	forceCornerRedraw();
};

this.forceCornerRedraw = function() {
	// Bugfix (a bit ugly, I know) to force the corners to redraw on changing tabs or resizing windows
	var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
	sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
	sscode += '@-moz-document url("'+document.baseURI+'") {\n';
	sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:before, findbar[movetotop]:after { padding-bottom: 1px !important; }\n';
	sscode += '}';
	styleAid.load('tempRedrawCorners_'+_UUID, sscode, true);
	aSync(function() {
		styleAid.unload('tempRedrawCorners_'+_UUID);
	}, 10);
};

this.findPersonaPosition = function(aSubject, aTopic) {
	if(!trueAttribute(mainWindow, 'lwtheme')) {
		prefAid.lwthemebgImage = '';
		prefAid.lwthemebgWidth = 0;
		prefAid.lwthemecolor = '';
		prefAid.lwthemebgColor = '';
		stylePersonaFindBar();
		return;
	}
	
	var windowStyle = getComputedStyle(mainWindow);
	if(prefAid.lwthemebgImage != windowStyle.getPropertyValue('background-image') && windowStyle.getPropertyValue('background-image') != 'none') {
		prefAid.lwthemebgImage = windowStyle.getPropertyValue('background-image');
		prefAid.lwthemecolor = windowStyle.getPropertyValue('color');
		prefAid.lwthemebgColor = windowStyle.getPropertyValue('background-color');
		prefAid.lwthemebgWidth = 0;
		
		lwthemeImage = new window.Image();
		lwthemeImage.onload = function() { findPersonaWidth(); };
		lwthemeImage.src = prefAid.lwthemebgImage.substr(5, prefAid.lwthemebgImage.length - 8);
		return;
	}
	
	stylePersonaFindBar();
};

this.findPersonaWidth = function() {
	if(prefAid.lwthemebgWidth == 0 && lwthemeImage.naturalWidth != 0) {
		prefAid.lwthemebgWidth = lwthemeImage.naturalWidth;
	}
	
	if(prefAid.lwthemebgWidth != 0) {
		stylePersonaFindBar();
	}
};

this.stylePersonaFindBar = function() {
	// Unload current stylesheet if it's been loaded
	styleAid.unload('personaFindBar_'+_UUID);
	
	if(prefAid.lwthemebgImage != '') {
		var windowStyle = getComputedStyle(mainWindow);
		
		// Another personas in OSX tweak
		var offsetPersonaY = -moveTopStyle.top;
		var offsetWindowPadding = windowStyle.getPropertyValue('background-position');
		if(offsetWindowPadding.indexOf(' ') > -1 && offsetWindowPadding.indexOf('px', offsetWindowPadding.indexOf(' ') +1) > -1) {
			offsetPersonaY += parseInt(offsetWindowPadding.substr(offsetWindowPadding.indexOf(' ') +1, offsetWindowPadding.indexOf('px', offsetWindowPadding.indexOf(' ') +1)));
		}
		
		var barStyle = getComputedStyle(gFindBar);
		if(barStyle.getPropertyValue('direction') == 'ltr') {
			var findBarBorderStart = parseInt(barStyle.getPropertyValue('border-left-width'));
			var findBarBorderEnd = parseInt(barStyle.getPropertyValue('border-right-width'));
		} else {
			var findBarBorderStart = parseInt(barStyle.getPropertyValue('border-right-width'));
			var findBarBorderEnd = parseInt(barStyle.getPropertyValue('border-left-width'));
		}
		
		// I have no idea where does the -1 come from, it's not the findbars own border
		// or maybe it is, I'm using that for now.
		if(!prefAid.movetoRight) {
			var offsetPersonaXSide = 'left';
			var offsetPersonaX = -moveTopStyle.left -(prefAid.lwthemebgWidth - mainWindow.clientWidth) -findBarBorderStart;
		} else {
			var offsetPersonaXSide = 'right';
			var offsetPersonaX = -moveTopStyle.right -findBarBorderEnd;
		}
		
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
		sscode += '@-moz-document url("'+document.baseURI+'") {\n';
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:not([inPDFJS]) {\n';
		sscode += '	  background-image: ' + prefAid.lwthemebgImage + ' !important;\n';
		sscode += '	  background-color: ' + prefAid.lwthemebgColor + ' !important;\n';
		sscode += '	  color: ' + prefAid.lwthemecolor + ' !important;\n';
		sscode += '	  background-position: '+offsetPersonaXSide+' '+offsetPersonaX+'px top '+offsetPersonaY+'px !important;\n';
		sscode += '	  background-repeat: repeat !important;\n';
		sscode += '	  background-size: auto auto !important;\n';
		sscode += '	}\n';
		
		// There's just no way I can have rounded corners with personas
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:not([inPDFJS]):before, findbar[movetotop]:not([inPDFJS]):after { display: none !important; }\n';
		
		sscode += '}';
		
		styleAid.load('personaFindBar_'+_UUID, sscode, true);
	}
};

this.toggleNotificationState = function() {
	var inNotification =
		!viewSource
		&& gBrowser.getNotificationBox().currentNotification
		&& !gBrowser.getNotificationBox().notificationsHidden
		&& dispatch(gFindBar, { type: 'HideFindBarInNotification' }); // If something preventDefault()s this, it means the find bar can be shown
	
	toggleAttribute(gFindBar, 'inNotification', inNotification);
	
	styleAid.unload('inNotification');
	
	if(inNotification) {
		// I'm not using top and lastTopStyle values incremented because this comes before moveTop, and on resizing window, values wouldn't be accurate
		var notificationHeight = gBrowser.getNotificationBox().currentNotification.clientHeight + (gBrowser.getNotificationBox().currentNotification.clientTop *2) +1;
		
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
		sscode += '@-moz-document url("'+document.baseURI+'") {\n';
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop][inNotification] {\n';
		sscode += '		margin-top: '+notificationHeight+'px !important;\n';
		sscode += '	}\n';
		sscode += '}';
		
		styleAid.load('inNotification', sscode, true);
	}
};

this.changeLook = function() {
	// Apply the special style for the findbar in pdf documents
	if((isPDFJS && !trueAttribute(gFindBar, 'inPDFJS'))
	|| (!isPDFJS && trueAttribute(gFindBar, 'inPDFJS'))) {
		delayMoveTop();
	}
};

// Prevent the FindBar from being visible in chrome pages like the add-ons manager
this.hideOnChrome = function() {
	// Bugfix for Tree Style Tab (and possibly others): findbar is on the background after uncollapsing
	// So we do all this stuff aSync, should allow the window to repaint
	timerAid.init('hideOnChrome', function() {
		if(!gFindBarInitialized) { return; }
		
		var beforeState = gFindBar.collapsed;
		hideIt(gFindBar, isCurrentBrowserValid);
		
		// Sometimes switching to the add-ons manager and then back to another tab, the find bar would be poorly positioned
		if(gFindBar.collapsed != beforeState) {
			moveTop();
		}
		
		changeLook();
		toggleNotificationState();
	}, 0);
};

this.hideOnChromeContentLoaded = function(e) {
	// this is the content document of the loaded page.
	var doc = e.originalTarget;
	if(doc instanceof window.HTMLDocument) {
		// is this an inner frame?
		// Find the root document:
		while(doc.defaultView.frameElement) {
			doc = doc.defaultView.frameElement.ownerDocument;
		}
		
		if(doc == contentDocument) {
			hideOnChrome();
		}
	}
};

// Tab progress listeners, handles opening and closing of pages and location changes
this.hideOnChromeProgressListener = {
	onLocationChange: function(aBrowser, webProgress, request, location) {
		// Frames don't need to trigger this
		if(webProgress.DOMWindow == aBrowser.contentWindow) {
			hideOnChromeHandleBrowser(aBrowser, 100);
		}
	},
	
	// Mostly handles some necessary browser tags
	onProgressChange: function(aBrowser, webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) {
		hideOnChromeHandleBrowser(aBrowser, curTotalProgress);
	}
};

this.hideOnChromeHandleBrowser = function(aBrowser, curTotalProgress) {
	// I found the > 3 to be the best value for comparison ( coming from onProgressChange() for aboutBlankCollapse() ), from a lot of trial and errors tests
	if(aBrowser == gBrowser.mCurrentBrowser && curTotalProgress > 3) {
		hideOnChrome();
	}
};

this.hideOnChromeAttrWatcher = function(obj, prop, oldVal, newVal) {
	if(oldVal != newVal) {
		hideOnChrome();
	}
};

this.setOnTop = function(e) {
	if(!e || !e.defaultPrevented) {
		// Bugfix: in windows 8 the findbar's bottom border will jump clicking a button if we are showing the icons instead of the labels.
		// I have no idea why this happens as none of its children elements increase heights or margins.
		// But at least the findbar itself increases its height by 1px.
		// We only need to do this once, the findbar's height doesn't (or shouldn't) change
		var container = gFindBar.getElement('findbar-container');
		var height = container.clientHeight || gFindBar.clientHeight;
		
		// if !container.clientHeight means findbar is hidden, we can use bar.clientHeight because it takes the desired value in this case.
		// Sometimes, with the the bar closed, the height value is lower than it should be, so we check for that.
		if(findBarMaxHeight && findBarMaxHeight >= height) { return; }
		
		findBarMaxHeight = height;
		
		var containerStyle = getComputedStyle(container);
		var barStyle = getComputedStyle(gFindBar);
		
		height += parseInt(containerStyle.getPropertyValue('margin-bottom')) + parseInt(containerStyle.getPropertyValue('margin-top'));
		height += parseInt(barStyle.getPropertyValue('padding-bottom')) + parseInt(barStyle.getPropertyValue('padding-top'));
		height += parseInt(barStyle.getPropertyValue('border-bottom-width')) + parseInt(barStyle.getPropertyValue('border-top-width'));
		
		initFindBar('movetotop',
			function(bar) {
				setAttribute(bar, 'movetotop', 'true');
				bar.style.maxHeight = height+'px';
			},
			function(bar) {
				removeAttribute(bar, 'movetotop');
				bar.style.maxHeight = '';
			},
			true
		);
		
		// We also need to properly place the rounder corners, as their position can vary with themes
		var cornerMarginTop = -parseInt(barStyle.getPropertyValue('padding-top'));
		
		var sscode = '/*FindBar Tweak CSS declarations of variable values*/\n';
		sscode += '@namespace url(http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul);\n';
		sscode += '@-moz-document url("'+document.baseURI+'") {\n';
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:before,\n';
		sscode += '	window['+objName+'_UUID="'+_UUID+'"] findbar[movetotop]:after {\n';
		sscode += '	  margin-top: ' + cornerMarginTop + 'px !important;\n';
		sscode += '	}\n';
		sscode += '}';
		
		styleAid.load('placeCornersFindBar_'+_UUID, sscode, true);
	}
};

moduleAid.LOADMODULE = function() {
	prefAid.listen('movetoRight', moveTop);
	
	listenerAid.add(browserPanel, 'resize', browserPanelResized);
	listenerAid.add(window, 'WillOpenFindBar', setOnTop);
	listenerAid.add(window, 'OpenedFindBar', moveTop);
	listenerAid.add(window, 'ClosedFindBar', fixFindBarPosition);
	listenerAid.add(window, "UpdatedStatusFindBar", moveTopAsNeeded);
	listenerAid.add(window, "HighlightCounterUpdated", moveTopAsNeeded);
	listenerAid.add(window, 'FindBarUIChanged', moveTopAsNeeded);
	
	if(!viewSource) {
		// Register all opened tabs with a listener
		gBrowser.addTabsProgressListener(hideOnChromeProgressListener);
		listenerAid.add(gBrowser.tabContainer, "TabSelect", hideOnChrome, false);
		listenerAid.add(gBrowser, "DOMContentLoaded", hideOnChromeContentLoaded, false);
		objectWatcher.addAttributeWatcher($('cmd_find'), 'disabled', hideOnChromeAttrWatcher);
		
		// Compatibility with LessChrome HD
		listenerAid.add(window, "LessChromeShown", moveTop, false);
		listenerAid.add(window, "LessChromeHidden", moveTop, false);
		
		observerAid.add(findPersonaPosition, "lightweight-theme-changed");
	}
	
	// Reposition the findbar when the window resizes
	listenerAid.add(browserPanel, "browserPanelResized", delayMoveTop, false);
	
	moveTop();
	
	if(!viewSource) {
		// we just init this so we can easily remove the collapsed state and others later when disabling the module if necessary
		initFindBar('resetTopState',
			function(bar) { return; },
			function(bar) {
				hideIt(bar, true);
				removeAttribute(bar, 'inPDFJS');
				removeAttribute(bar, 'inNotification');
			}
		);
		
		hideOnChrome();
	}
};

moduleAid.UNLOADMODULE = function() {
	if(!viewSource) {
		observerAid.remove(findPersonaPosition, "lightweight-theme-changed");
		
		// Compatibility with LessChrome HD
		listenerAid.remove(window, "LessChromeShown", moveTop, false);
		listenerAid.remove(window, "LessChromeHidden", moveTop, false);
		
		objectWatcher.removeAttributeWatcher($('cmd_find'), 'disabled', hideOnChromeAttrWatcher);
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", hideOnChrome, false);
		listenerAid.remove(gBrowser, "DOMContentLoaded", hideOnChromeContentLoaded, false);
		gBrowser.removeTabsProgressListener(hideOnChromeProgressListener);
		
		styleAid.unload('inNotification');
		
		for(var b=0; b<gBrowser.browsers.length; b++) {
			var inDoc = gBrowser.browsers[b].contentDocument;
			if(inPDFJS(inDoc)) {
				listenerAid.remove(contentDocument.defaultView, 'resize', containerPDFResize, true);
			}
		}
		
		deinitFindBar('resetTopState');
	}
	
	listenerAid.remove(browserPanel, "browserPanelResized", delayMoveTop, false);
	
	listenerAid.remove(window, 'FindBarUIChanged', moveTopAsNeeded);
	listenerAid.remove(window, 'WillOpenFindBar', setOnTop);
	listenerAid.remove(window, 'OpenedFindBar', moveTop);
	listenerAid.remove(window, 'ClosedFindBar', fixFindBarPosition);
	listenerAid.remove(window, "UpdatedStatusFindBar", moveTopAsNeeded);
	listenerAid.remove(window, "HighlightCounterUpdated", moveTopAsNeeded);
	listenerAid.remove(browserPanel, 'resize', browserPanelResized);
	
	deinitFindBar('movetotop');
	
	prefAid.unlisten('movetoRight', moveTop);
	
	styleAid.unload('personaFindBar_'+_UUID);
	styleAid.unload('topFindBar_'+_UUID);
	styleAid.unload('topFindBarCorners_'+_UUID);
	styleAid.unload('tempRedrawCorners_'+_UUID);
	styleAid.unload('placeCornersFindBar_'+_UUID);
};
