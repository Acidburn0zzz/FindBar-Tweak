moduleAid.VERSION = '1.2.3';

this.highlightByDefault = function() {
	if(viewSource || gFindBarInitialized) {
		gFindBar.getElement("highlight").checked = true;
	}
};

this.highlightByDefaultOnOpening = function(e) {
	if(e.defaultPrevented || !gFindBar.hidden) { return; }
	
	highlightByDefault();
};

this.highlightByDefaultOnContentLoaded = function(e) {
	// this is the content document of the loaded page.
	var doc = e.originalTarget;
	if(doc instanceof window.HTMLDocument) {
		// is this an inner frame?
		// Find the root document:
		while(doc.defaultView.frameElement) {
			doc = doc.defaultView.frameElement.ownerDocument;
		}
		
		if(doc == contentDocument) {
			highlightByDefault();
		}
	}
};

// Tab progress listeners, handles opening and closing of pages and location changes
this.highlightByDefaultProgressListener = {
	// Commands a reHighlight if needed, triggered from history navigation as well
	onLocationChange: function(browser, webProgress, request, location) {
		// Frames don't need to trigger this
		if(webProgress.DOMWindow == browser.contentWindow) {
			if(browser == gBrowser.mCurrentBrowser) {
				if(request && !request.isPending()) {
					highlightByDefault();
				}
			}
		}
	}
};

this.highlightByDefaultTabSelect = function() {
	if(prefAid.perTab) {
		highlightByDefault();
	}
};

moduleAid.LOADMODULE = function() {
	listenerAid.add(window, 'WillOpenFindBar', highlightByDefaultOnOpening);
	
	// Always highlight all by default when selecting text and filling the findbar with it
	listenerAid.add(window, 'WillFillSelectedText', highlightByDefault);
	
	if(!viewSource) {
		listenerAid.add(gBrowser.tabContainer, "TabSelect", highlightByDefaultTabSelect);
		listenerAid.add(gBrowser, "DOMContentLoaded", highlightByDefaultOnContentLoaded);
		gBrowser.addTabsProgressListener(highlightByDefaultProgressListener);
	}
	
	// Sometimes, when restarting firefox, it wouldn't check the box (go figure this one out...)
	aSync(highlightByDefault);
};

moduleAid.UNLOADMODULE = function() {
	listenerAid.remove(window, 'WillOpenFindBar', highlightByDefaultOnOpening);
	listenerAid.remove(window, 'WillFillSelectedText', highlightByDefault);
	
	if(!viewSource) {
		listenerAid.remove(gBrowser.tabContainer, "TabSelect", highlightByDefaultTabSelect);
		listenerAid.remove(gBrowser, "DOMContentLoaded", highlightByDefaultOnContentLoaded);
		gBrowser.removeTabsProgressListener(highlightByDefaultProgressListener);
		
		for(var t=0; t<gBrowser.mTabs.length; t++) {
			var tab = gBrowser.mTabs[t];
			if(tab._findBar && !trueAttribute(tab._findBar.browser.contentDocument.documentElement, 'highlighted')) {
				tab._findBar.getElement("highlight").checked = false;
			}
		}
	}
};
