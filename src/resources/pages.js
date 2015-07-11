/**
 * Copyright (c) 2010 Andres Hernandez Monge and 
 * Copyright (c) 2011-2012 David M. Adler
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of copyright holders nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL COPYRIGHT HOLDERS OR CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";

var EXPORTED_SYMBOLS = [];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

// EXTS is a non-remembering expression which matches
// image file suffixes.
const EXTS = "(?:\\.gif|\\.jpe?g|\\.png|\\.bmp|\\.svg|\\.webm)";
const EXTS_RE = new RegExp(EXTS, 'i');

Cu.import("resource://thumbnailzoomplus/common.js");
Cu.import("resource://thumbnailzoomplus/pagesIndirect.js");

/**
 * Pages namespace
 */
if ("undefined" == typeof(ThumbnailZoomPlus.Pages)) {

  ThumbnailZoomPlus.Pages = {
    /* Logger for this object. */
    _logger : null,

    /**
     * Initializes the resource.
     */
    _init : function() {
      this._logger = ThumbnailZoomPlus.getLogger("ThumbnailZoomPlus.Pages");
      this._logger.trace("_init");
    }
  };
  
  ThumbnailZoomPlus.Pages._init();
};

/***********
  Define rules for each page.
  
  Each page is an object such as ThumbnailZoomPlus.Pages.Facebook, which
  is stored as an element in ThumbnailZoomPlus.FilterService.pageList[].

  Fields:

    * key: a unique lower-case string which identifies the rule in preferences
      and elsewhere.  eg "facebook".  You can use the same key in multiple
      entries if they are all controlled by the same enable state (and in
      that case you'll probably want to set name to null for all but one).

    * name: user-visible rule name, often starting with captial letter.  Appears
      .g. in the tool menu's checkboxes.  eg "Facebook".  Set to "" for the 
      name to come from entity &thumbnailzoomplus-toolbar-menuitem-<key>;
      (for localized names).  Set to null to hide this item from the toolbar
      menu if 'enable' flags.

    * host: regular expression which the hostname of the page containing the
      thumbnail or link must match for the rule to apply.  THIS APPLIES
      TO THE PAGE WHICH HOSTS THE LINK OR THUMB, NOT THE IMAGE ITSELF.
      Remember to backslash-quote literal dots.  eg /^(.*\.)?facebook\.com$/

    * hostDisallow: optional regular expression which the hostname of the page containing
      the thumbnail or link must NOT match for the rule to apply.  THIS APPLIES
      TO THE PAGE WHICH HOSTS THE LINK OR THUMB, NOT THE IMAGE ITSELF.
      Remember to backslash-quote literal dots.  eg /^(.*\.)?facebook\.com$/

    * preferLinkOverThumb: optional boolean indicates that when the hovered
      node has both an href and a background-image, prefer to use the
      link rather than the background-image.  Defaults false.
    
    * imageRegExp: the popup image URL produced by the rule must match this 
      pattern or else it'll be rejected.  Helps prevent error icon from appearing
      due to generating an image URL which isn't really an image.
      Note that this is applied to the initial URL we have after getImageNode, 
      but before getZoom Image (which is kind of odd; maybe we should change it).
      eg /profile|\/app_full_proxy\.php|\.(fbcdn|akamaihd)\.net\/.*(safe_image|_[qstan]\.|([0-9]\/)[qsta]([0-9]))/
      See also imageDisallowRegExp.
      
    * imageDisallowRegExp: optional.  Won't run the rule if the URL produced by 
      getImageNode matches this pattern (even if it matches imageRegExp).  Using
      this can run faster and be easier to understand than using a negative 
      look-ahead pattern in imageRegExp.

    * getImageNode: optional function(aNode, nodeName, nodeClass, imageSource, pageSpecificData).
      Returns the node from which the popup image's link will be generated, or 
      null if the popup should be disabled (i.e. to REJECT the popup).  
      Useful when it's generated not from the direct thumbnail image, but an ancestor or
      peer node.  The image URL will be extracted (in fiterService.js) from the 
      returned node's src, href, or background image (assuming the return is
      different than aNode).  ImageSource is the URL of the link or image the
      mouse hovered; it may be null if the hovered node isn't an image or link.  
      The default function returns the image node itself.  Optional arg pageSpecificData
      is an object (initally {}) to which getImageNode can add fields of data to be returned,
      which will be passed into the corresponding call to getZoomImage.
      
    * getZoomImage: required function(aImageSrc, node, popupFlags, pageSpecificData, pageCompletionFunc);
      returns the image URL.
     
      Translates the aImageSrc URL from the previous functions into the final
      URL of the full-size image for the popup, for example by
      removing ".thumb" from the URL.  Returns null if it can't produce a 
      valid full-size image URL from the specified aImageSrc, or "" if it
      can't because the user has disabled some other page related to the URL.
      Function can optionally modify members of flags, which is of class
      ThumbnailZoomPlus.FilterService.PopupFlags.  node is the node the user
      hovered, useful e.g. if you want to check its class.  You could decided
      to use a different (probably related) node, but note that getZoomImage
      won't even get called unless the hovered node has an image (otherwise
      you'd need to use getImageNode).  Also, if you use a different node,
      that node will not be considered by site enable flags.

      pageSpecificData is the same object which was sent into getImageNode, and
      which contains any fields added by that routine.  It lets you
      pass arbitrary data from getImageNode into getZoomImage.
 
      The last argument pageCompletionFunc is optional and is for supporting
      asynchronous functions.  If getZoomImage wants to work asynchronously,
      it should return the string "deferred".  In that case, it must cause
      pageCompletionFunc(result) to be called sometime later (e.g. due to
      some event handler).  The result passed into pageCompletionFunc is the
      same as would be returned from this function in a synchronous call: the
      image URL.
      
    * aPage: the index of this page in 
      ThumbnailZoomPlus.FilterService.pageList[].  Not set in pages.js; 
      assigned by calculation in filterService.js.
      
 ***********/

let _allMatchesOf = function(re, firstMatch, aHTMLString, resultPattern) {
    // Return a string or array of strings representing all the matches of re
    // in aHTMLString, where the first match has already been done,
    // and is firstMatch.  Each match returns resultPattern with "$1"
    // replaced by the contents of the first re group.  Only $1
    // is supported (not $2 etc).
    // The regular expression must have the 'g' global flag (/..../g).
    var matches = new Array();
    var match = firstMatch;
    var nMatches = 0;
    while (match != null) {
      var url = resultPattern.replace("$1", match[1]);
      ThumbnailZoomPlus.Pages._logger.debug("_allMatchesOf: url=" + url +
                 "; re.lastIndex=" + re.lastIndex);
      // append the url if it's not a dummy imgur url and not a dup
      // of the previous one (both of which I've seen on imgur.com).
      if (url != "http://i.imgur.com/" &&
          url != "https://i.imgur.com/" &&
          (matches.length == 0 || matches[matches.length-1] != url) ) {
        matches.push(url);
      }
      ++nMatches;
      if (nMatches > 5000) {
        // prevent infinite or very long loop
        break;
      }
      match = re.exec(aHTMLString);
    }
    if (matches.length == 1) {
      // single match (not handled as a gallery).
      return matches[0];
    } else {
      return matches;
    }
  };

/**
 * Facebook
 */
ThumbnailZoomPlus.Pages.Facebook = {
  key: "facebook",
  name: "Facebook",
  host: /^(.*\.)?facebook\.com$/,
  /*
     The Facebook operates in a few ways:
   
     1. for photos and user profiles, we operate like Others (Indirect), but within the Facebook rule.
     The URL we retrieve is the mobile version of the photo's page since that one
     contains a direct HTML link to the full-size image, without needing to
     run javascript from the facebook page.
     
     2. for profile photos, we do TWO levels of indirect.  The first retrieves the user's
     main profile page.  The second retrieves their profile photo's page, from which
     we finally get the URL of the full-size profile pic.
     
     Note that for profile photos, the linked-to mobile page is different
     when logged in vs logged out.
   
     2. for some externally-linked pages, we can parse the external photo's
     image URL from the Facebook image URL.

     Thumb URLs seem different when logged into Facebook vs when logged out
     and refreshed.  When logged in I see akamaihd; when logged out I see fbcdn.
     test e.g. at https://www.facebook.com/Levis?sk=wall

     Starting 2014-11-11, some photos require different numbers in oh=, oe=, __gda= fields for
     zoomed vs thumb versions of images, so we can't guess the zoomed URL from the thumb URL.
     That forced us to handle photos via Others Indirect.  The Facebook rule is still
     used for profile pics and external images.
     thm: https://fbcdn-sphotos-e-a.akamaihd.net/hphotos-ak-xaf1/v/t1.0-9/p160x160/10801477_10103893622580956_2905797505770087574_n.jpg?oh=c6ed5728455547333f5855fc2bfe547a&oe=54D78CE3&__gda__=1424072726_dc5cd404f5ea19141fdf7c39b10f1b38 becomes
     yes: https://fbcdn-sphotos-e-a.akamaihd.net/hphotos-ak-xaf1/v/t1.0-9/10801477_10103893622580956_2905797505770087574_n.jpg?oh=f7dba9f6a60b911ee8e28e428430af7d&oe=54EDEA9F&__gda__=1424364075_fd53e5ce389c4a1be8223de4655df1e3
     no:           https://fbcdn-sphotos-e-a.akamaihd.net/hphotos-ak-xaf1/10801477_10103893622580956_2905797505770087574_n.jpg?oh=c6ed5728455547333f5855fc2bfe547a&oe=54D78CE3&__gda__=1424072726_dc5cd404f5ea19141fdf7c39b10f1b38
   */
  imageRegExp : new RegExp("^[^/]*("
                          + "//[^/?]+/[^/?]+$"
                          + "|.*[?&]fref=(photo|hovercard|pb|ts)"
                          + "|//graph\\.facebook\\.com.*/picture"
                          + "|.*/ajax/hovercard/hovercard\\.php\\?id=[0-9]+&" // logged-out profile pic
                          + "|//[a-z0-9]+\\.facebook\\.com/photo\\.php\\?fbid="
                          + "|//[a-z0-9]+\\.facebook\\.com/[^/?]+/photos/" // eg https://www.facebook.com/SimiMissingPets/photos/...
                          + "|.*/safe_image.php\\?"
                          + ").*", "i"),

  getImageNode : function(aNode, aNodeName, aNodeClass, imageSource, pageSpecificData) {
    pageSpecificData.originalNode = aNode;
    pageSpecificData.originalImageURL = imageSource;
    
    if (/_6l-|photoWrap|uiPhotoThumb|external|_2qo3/.test(aNodeClass)) {
      // The hover detects a <div> and we need to find its child <img>.
      // _117p = fb Page cover photo; _6l- = external image
      var parent = aNode;
      if (/_2qo3/.test(aNodeClass)) {
        // For a photo for a linked article (/l.php), the img node is a child of the
        // great grandparent.  Structure is <div><a><div><img/></div></a>   <div><div><A>...
        // where hover is detected on <A>.
        parent = aNode.parentNode.parentNode.parentNode;
      }
      let imgNodes = parent.getElementsByTagName("img");
      if (imgNodes.length > 0) {
        // take the first child.
        return imgNodes[0];
      }
    }

    if (aNodeName != "img" && aNodeName != "i" && ! aNode.querySelector("img") && !/coverBorder/.test(aNodeClass)) {
      // Don't use this rule for e.g. profile thumbs which link to
      // hovercard facebook pop-ups, or textual links.
      // 'i' tags are seen in e.g. a user's albums.
      // coverBorder seen over cover photo on <div> not containing <img>
      ThumbnailZoomPlus.debugToConsole("facebook getImageNode: reject due to non-img node type " + aNodeName);
      return null;
    }
    
    if (/\/safe_image.php\?/.test(imageSource)) {
      return aNode;
    }
    
    // We'll detect profile thumbs from the page they link to, which we get
    // from Others.getImageNode.
    aNode = ThumbnailZoomPlus.Pages.Others.getImageNode(aNode, aNodeName, aNodeClass, imageSource);
    if (! aNode) {
      return null;
    }
    
    var href = aNode.getAttribute("href");
    ThumbnailZoomPlus.debugToConsole("facebook getImageNode: node " + aNode +
                                     " href=" + href);
    if ("?fref=hovercard" == href) {
      // as seen on hovercard profile pic when logged-out (eg comments on a public page).
      ThumbnailZoomPlus.debugToConsole("facebook getImageNode: reject due to fref=hovercard w/o username");
      return null;
    }

    return aNode;
  },
  
  /**
   * tries to get an image URL from the aHTMLString, either via
   * _getImgFromHtmltext (raw text parsing) or via getImgFromSelectors
   * (html-based CSS selectors to find the appropriate node).
   *
   * Returns a URL string, and array of them, or null.
   */
  _getImageFromFBHtml : function(doc, pageUrl, flags, aHTMLString)
  {    
    let logger = ThumbnailZoomPlus.Pages._logger;
    logger.trace("_getImageFromFBHtml");

    var re;

    // m.facebook.com

    if (! /photo\.php|\/photos\//.test(pageUrl)) {
      // Check for profile page's link to user's photo.  Note that a profile pic
      // page may also match this if it has Previous and Next links; we count on
      // that matching the check above first.
      re = /<div[^>]* class="[^"]*bj.*? href="(\/photo\.php\?[^"]*)"/;
      logger.debug("_getImgFromHtmlText: trying " + re);
      var match = re.exec(aHTMLString);
      if (match) {
        logger.debug("_getImgFromHtmlText: detected profile page, with photo page URL " + match[1]);
        return match[1].replace(/&amp;/gi, "&");
      }
    }

    // matching e.g. '<a class="bs" href="https://fbcdn-sphotos-b-a.akamaihd.net/hphotos-ak-xfp1/t31.0-8/1051...7_o.jpg">
    // View Full Size</a>'  Class and "View Full Size" text vary.
    re = /<(?:a|img)[^>]* (?:src|href)="([^"]+(?:-photo-|\/hphotos-|\/hprofile-)[^"]+\.(?:jpg|png)[^"]*)"/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    var match = re.exec(aHTMLString);
    if (match) {
      return match[1].replace(/&amp;/gi, "&");
    }

    logger.debug("_getImageFromFBHtml: didn't match");
    return null;  
  },
  
  getZoomImage : function(aImageSrc, node, flags, pageSpecificData, pageCompletionFunc) {
    var original = aImageSrc;
    var originalNode = pageSpecificData.originalNode;
    var aNodeClass = node.getAttribute("class");
    var originalImageURL = pageSpecificData.originalImageURL;
    
    ThumbnailZoomPlus.debugToConsole("facebook getZoomImage: node=" +
                                          node + "; class=" +
                                          aNodeClass + "; originalNode=" +
                                          originalNode + "; originalNodeClass=" +
                                          originalNode.className + "; originalImageURL=" +
                                          pageSpecificData.originalImageURL);

    // disabled: handle profile links.
    // https://www.facebook.com/profile.php?id=1553390408&fref=hovercard
    if (false && /profile-/.test(originalImageURL)) {
        // only show a profile pop-up if the image the link surrounds is a profile image.
        // This excludes it for the top part of cover photo in hovercard pop-up.
        ThumbnailZoomPlus.debugToConsole("facebook getZoomImage: trying as profile pic");
        aImageSrc = aImageSrc.replace(/:\/\/(?:[a-z0-9]+\.)?facebook\.com\/profile\.php\?id=([^\/?&]+)(?:&fref=(?:photo|hovercard|pb|ts))?$/,
                                        "://graph.facebook.com/$1/picture?width=750&height=750");
        aImageSrc = aImageSrc.replace(/:\/\/(?:[a-z0-9]+\.)?facebook\.com\/([^\/?]+)(?:\?fref=(?:photo|hovercard|pb|ts))?$/,
                                        "://graph.facebook.com/$1/picture?width=750&height=750");
        aImageSrc = aImageSrc.replace(/:\/\/(?:[a-z0-9]+\.)?facebook\.com\/messages\/([^\/?]+)$/,
                                        "://graph.facebook.com/$1/picture?width=750&height=750");
        aImageSrc = aImageSrc.replace(/:\/\/(?:[a-z0-9]+\.)?facebook\.com\/ajax\/hovercard\/hovercard\.php\?id=([0-9]+)&.*/,
                                        "://graph.facebook.com/$1/picture?width=750&height=750");
    } else {
        ThumbnailZoomPlus.debugToConsole("facebook getZoomImage: not a profile pic; " + originalImageURL);
    }
    
    let ajaxify = node.getAttribute("ajaxify");
    if (false && ajaxify) { // disabled until we can verify it still always works.
      let match = /\&src=([^\&]+)/.exec(ajaxify);
      ThumbnailZoomPlus.debugToConsole("facebook getZoomImage: ajaxify=" + ajaxify + "; match=" + match);
      if (match) {
        aImageSrc = unescape(match[1]);
      } else {
        // seen 2014-04-18: https://www.facebook.com/charlesphoenix.usa/photos/a.378890579425.160195.153552674425/10152093900964426/?type=1&src=https%3A%2F%2Fscontent-a-lax.xx.fbcdn.net%2Fhphotos-prn2%2Ft1.0-9%2F1902874_10152093900964426_3846687682006043902_n.png&size=936%2C699&fbid=10152093900964426&source=13
        aImageSrc = ajaxify;
      }
    }
    
    // TODO: do these still work, now that getImageNode is using Others.getImageNode?
    
    // Handle externally-linked images.
    let rexExternal = /.*\/safe_image.php\?(?:.*&)?url=([^&]+).*/;
    if (rexExternal.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(rexExternal, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
      return aImageSrc;
    }

    let appRex = /.*\/app_full_proxy.php\?.*&src=([^&]+)$/;
    if (appRex.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(appRex, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
      return aImageSrc;
    }
    
    if (/_q\./.test(aImageSrc)) {
      // Make sure we avoid positioning our popup will Facebook's wil be.
      flags.popupAvoiderTBEdge = "midpage"; 
      flags.popupAvoiderHeight = 1;
      flags.allowRight = false;
    } else if (/_n\./.test(aImageSrc)) {
      // These thumbs sometimes have a tooltip-like popup showing their
      // profile name above the image.
      flags.allowAbove = false;
    }

    // http://graph.facebook.com/1368249070/picture?type=square becomes
    // http://graph.facebook.com/1368249070/picture?type=large
    // e.g. from pandora.com.
    aImageSrc = aImageSrc.replace(/(graph\.facebook\.com\/.*\/picture\?type=)square/, "$1large");
    
    if (original == aImageSrc && node.localName.toLowerCase() == "a") {
        // This isn't a profile or other recognized case; try to handle as a photo
        // in the manner of Others (Indirect).
        
        // Convert www.facebook.com to m.facebook.com so we can parse it for an image URL
        // without running the page's javascript.
        aImageSrc = aImageSrc.replace(/:\/\/[a-z0-9]+\.facebook\.com\//, "://m.facebook.com/")

        ThumbnailZoomPlus.Pages.OthersIndirect.invocationNumber++;
 
        // The completion func we pass to getImageFromLinkedPage is an "intermediate" one,
        // so that if we're over a profile thumb, we can invoke getImageFromLinkedPage again
        // to get the photo's URL.
        let intermediateCompletionFunc = function(result) {
          if (/photo\.php\?/.test(result)) {
            // profile photo page link.
            result = ThumbnailZoomPlus.FilterService.applyBaseURI(node.ownerDocument, result);
            // Convert www.facebook.com to m.facebook.com so we can parse it for an image URL
            // without running the page's javascript.
            result = result.replace(/:\/\/[a-z0-9]+\.facebook\.com\//, "://m.facebook.com/")
            ThumbnailZoomPlus.debugToConsole("facebook getZoomImage: need second level of indirect for profile pic, from " + result);
            aImageSrc = ThumbnailZoomPlus.PagesIndirect.
                getImageFromLinkedPage(node.ownerDocument, result, flags,
                                       ThumbnailZoomPlus.Pages.OthersIndirect.invocationNumber,
                                       pageCompletionFunc,
                                       this._getImageFromFBHtml.bind(this));
          } else {
            pageCompletionFunc(result);
          }
        }

        aImageSrc = ThumbnailZoomPlus.PagesIndirect.
                    getImageFromLinkedPage(node.ownerDocument, aImageSrc, flags,
                                           ThumbnailZoomPlus.Pages.OthersIndirect.invocationNumber,
                                           intermediateCompletionFunc.bind(this),
                                           this._getImageFromFBHtml.bind(this));
    }

    return aImageSrc;
  }
};

/**
 * Twitter
 */
ThumbnailZoomPlus.Pages.Twitter = {
  key: "twitter",
  name: "Twitter",
  
  // We match anything with timg to catch things like twimg0-a.akamaihd.net
  host: /^(.*\.)?(twitter\.com$|twimg[.0-9-])/,
  imageRegExp: /(twitter\.com\/|twimg[.0-9-])/,
  getZoomImage : function(aImageSrc, node, flags) {
  
    let rex = new RegExp(/_(bigger|mini|normal|reasonably_small)(?![^.])/);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "") : null);
    return image;
  }
};

/**
 * Twitpic
 */
ThumbnailZoomPlus.Pages.Twitpic = {
  key: "twitpic",
  name: "Twitpic",   
  
  // Host includes twitter.com since twitter often hosts twitpic images.
  host: /^(.*\.)?(twitpic\.com|twitpicproxy.com|twitter\.com|twimg|skylin.es|picfog\.com|twicsy\.com)$/,
  imageRegExp:
    /^(.*[.\/])?(twimg[.0-9-].*|twitpic\.com(?:\/).*\/([a-z0-9A-Z]+)$|yfrog.com|api\.plixi\.com.*url=|photobucket\.com|instagr\.am|instagram\.com|twitpicproxy\.com|photozou.jp\/p\/img\/)/,
    
  imageDisallowRegExp : /.*twimg.*\/img\/front_page\//, // Twitter background image on login page.

  getImageNode : function(node, nodeName, nodeClass, imageSource) {
    // If thumbnail-active-border-inner, the currently-selected thumbnail 
    // in slideshow view has a div
    // superimposed on it; find the corresponding img.
    // example: https://twitter.com/#!/TheRomMistress/media/slideshow?url=pic.twitter.com%2FfNwHmcGv
    if (nodeClass == "thumbnail-active-border-inner") {
      // Find child "img" nodes
      let imgNodes = node.parentNode.parentNode.getElementsByTagName("img");
      if (imgNodes.length > 0) {
        // take the last child.
        node = imgNodes[imgNodes.length-1];
      }
    }
    // If preview-hoverpart, then a popup on skylin.es
    if ("preview-hoverpart" == node.id) {
      // Find child "img" nodes
      let imgNodes = node.parentNode.getElementsByTagName("img");
      if (imgNodes.length > 0) {
        // take the last child.
        node = imgNodes[imgNodes.length-1];
      }
    }
    return node;
  },
    
  getZoomImage : function(aImageSrc, node, flags) {
    // lockerz, etc.:
    // http://api.plixi.com/api/tpapi.svc/imagefromurl?size=medium&url=http%3A%2F%2Flockerz.com%2Fs%2F198302791
    let rexPlixi = new RegExp("(.*/api\\.plixi\\.com/.*[?&])size=[a-z]+(.*)$");
    let rex1 = new RegExp(/[:_](small|thumb|bigger|mini|normal|reasonably_small)(?![^.])/);
    let rex2 = new RegExp(/-(mini|thumb)\./);
    // eg http://twitpic.com/show/mini/563w31; in this case mini and iphone exist but full doesn't.
    let rex3 = new RegExp(/\/(mini|thumb|iphone|large)\//);
    let rexInstagram = new RegExp("((instagr\\.am|instagram.com)/p/.*size)=[a-z]$");
    let rex4 = new RegExp(/\?size=t/);
    // yfrog: http://yfrog.com/gyw3xnpj:twthumb -> http://yfrog.com/gyw3xnpj:iphone
    // see also http://code.google.com/p/imageshackapi/wiki/YFROGurls
    let rex5 = new RegExp("(://yfrog\\..*):twthumb"); 
    // http://s235.photobucket.com/albums/ee124/snasearles/?action=view&current=IMAG0019.jpg ->
    // http://s235.photobucket.com/albums/ee124/snasearles/IMAG0019.jpg
    let rex6 = new RegExp("(\.photobucket\.com/albums/.*/)\\?.*=([a-z0-9]\\.[a-z0-9]+)", "i");
    let rexNoModNecessary = new RegExp(/(\/large\/|yfrog\.com|instagr\.am|lockers\.com|instagram.com|\.photobucket\.com\/albums|photozou\.jp\/p\/img\/)/);
    
    // photozou.jp:
    // http://photozou.jp/p/img/91576005 use as-is
    
    ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic p10: " + aImageSrc);

    /*
     * We could resolutions to "large".  Another option is "full", which is bigger,
     * but the server seems quite slow and "full" could take several seconds to
     * load even on a high-speed connection.
     * But some images have "full" size but not "large" size.
     * Ideally we'd try "large" but if it fails, try "full".
     * For now we use "full" to assure we get something, but it may be slow.
     */
    let image = null;
    
    if (rexPlixi.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rexPlixi");
      // See http://support.lockerz.com/entries/350297-image-from-url
      image = aImageSrc.replace(rexPlixi, "$1size=big$2");
    } 
    
    if (rex1.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex1");
      image = aImageSrc.replace(rex1, "");

    } else if (rex2.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex2");
      image = aImageSrc.replace(rex2, "-full.");

    } else if (rex3.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex3");
      image = aImageSrc.replace(rex3, "/iphone/");

    } else if (rexInstagram.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rexInstagram");
      image = aImageSrc.replace(rexInstagram, "$1=l");

    }  else if (rex4.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex4");
      image = aImageSrc.replace(rex4, "?size=f");

    } else if (rex5.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex5");
      image = aImageSrc.replace(rex5, "$1:iphone");

    } else if (rex6.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rex6");
      image = aImageSrc.replace(rex6, "$1$2");

    } else if (rexNoModNecessary.test(aImageSrc)) {
      ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic: rexNoModNecessary");
      image = aImageSrc;
    } else {
        // https://pbs.twimg.com/media/ByhBR9PCQAA1KG4.jpg becomes
        // https://pbs.twimg.com/media/ByhBR9PCQAA1KG4.jpg:large
        image = aImageSrc.replace(/(\/\/pbs\.twimg\.com\/media\/.*\.jpg)$/, "$1:large");
    }
    
    ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic p20: " + image);
    if (image == null) {
      return null;
    }

    // some twitpic images don't work with https so use http instead.
    image = image.replace(new RegExp("https://twitpic\\.com/"), "http://twitpic.com/");

    if (false) {
      // This is disabled because while it may sometimes help, more often it 
      // fails, adding .jpg where the image actually shouldn't have any suffix.
      // If we could return multiple filenames, we could use this logic.
      
      // If site is twimg or twitpic, make sure it has an image extension (.jpg default).
      // But not for profile_images, which actually sometimes don't have a suffix.
      if (/twitpic\.com|twimg/.test(image) &&
          ! EXTS_RE.test(image) &&
          ! /\/profile_images\//.test(image)) {
        image += ".jpg";
      }
    }
    
    ThumbnailZoomPlus.Pages._logger.debug("getZoomImage twitpic p50: " + image);

    return image;
  }
};

/**
 * LinkedIn
 */
ThumbnailZoomPlus.Pages.LinkedIn = {
  key: "linkedin",
  name: "LinkedIn",
  host: /^(.*\.)?linkedin\.com$/,
  imageRegExp: /\/mpr\//,
  getZoomImage : function(aImageSrc, node, flags) {
    return aImageSrc.replace(/\/shrink_[0-9][0-9]_[0-9][0-9]\//, "/");
  }
};

/**
 * Amazon
 */
ThumbnailZoomPlus.Pages.Amazon = {
  key: "amazon",
  name: "Amazon",
  // Work on amazon.com, amazon.cn, https://amazon.co.uk, etc.
  // examples:
  // https://images-eu.ssl-images-amazon.com/images/I/51aYWCfdQkL._SL135_.jpg
  host: /^(.*\.)?((ssl-)?images-)?amazon\.(co\.)?[a-z]+$/,
  
  // Product images seem to come from exc.images-amazon.com.  Static graphics
  // like banners, "Prime" buttons, etc. seem to come from g-exc.images-amazon.com,
  // or have /buttons/ or /gui/ in their URL.
  // See similar rule at start of Thumbnails rule.
  imageRegExp: /^((?!.*g-ecx\.).*\.)(ssl-)?images\-amazon\.com\/images\/(?!.*(buttons|gui|ontv)\/).*/,

  getZoomImage : function(aImageSrc, node, flags) {
    let ex = /\._[a-z0-9].+_\./i;
    if (ex.test(aImageSrc)) {
      return aImageSrc.replace(ex, ".");
    } else {
      return null;
    }
  }
};

/**
 * Hi5
 */
ThumbnailZoomPlus.Pages.Hi5 = {
  key: "hi5",
  name: "Hi5",
  host: /^(.*\.)?hi5\.com$/,
  imageRegExp: /photos|pics|image/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/\-01\./);
    let rex2 = new RegExp(/\.small\./);
    let rex3 = new RegExp(".*/hi5image[0-9]+/([0-9]+/.*)-0[1m](" +
                          EXTS+")");
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "-02.") :
                 rex2.test(aImageSrc) ? aImageSrc.replace(rex2, ".") : 
                 rex3.test(aImageSrc) ? aImageSrc.replace(rex3, "http://photos3.hi5.com/$1-02$2") :
                 null);
    return image;
  }
};

/**
 * Picasa
 */
ThumbnailZoomPlus.Pages.Picasa = {
  key: "picasa",
  name: "Picasa",
  host: /picasaweb\.google\.com$/,
  imageRegExp: /lh[0-9]+\.(ggpht|googleusercontent)\.com/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/s([0-9]{2}|[123][0-9]{2})(-[a-z])?\//);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/s700/") : null);
    return image;
  }
};

/**
 * MySpace
 */
ThumbnailZoomPlus.Pages.MySpace = {
  key: "myspace",
  name: "MySpace",
  host: /^(.*\.)?myspace\.com$/,
  imageRegExp: /images\.myspacecdn\.com/,
  
  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/(\/|\_)[smlt]\./i);
    let rex2 = new RegExp(/\/(sml|med|lrg)_/i);
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "$1l.") :
      (rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "/lrg_") : null));
    return image;
  }
};

/**
 * Netflix
 */
ThumbnailZoomPlus.Pages.Netflix = {
  key: "netflix",
  name: "Netflix",
  host: /^(.*\.)?(netflix\.com|netflix\..*llnwd\.net|instantwatcher\.com)$/,
  imageRegExp: new RegExp("\\.netflix\\.com/WiPlayer\\?movieid=|" +
                          "\\.netflix\\.com/WiMovie/.*/([0-9]+)\\?.*|" +
                          "(?:\\.nflximg\\.com/|netflix\.com|netflix\\..*llnwd\\.net).*" + EXTS + "$"),
  // eg https://secure.netflix.com/us/boxshots/large/70251536.jpg
  
  getImageNode : function(aNode, nodeName, nodeClass, imageSource) {
    if (nodeName == "a" || nodeName == "img") {
      return aNode;
    }
    return null;
  },

  getZoomImage : function(aImageSrc, node, flags) {
    // We'll set flags.popupAvoiderWidth for thumbs which cause
    // the site itself to display a popup; this allows TZP to avoid
    // positioning our own popup where the site's is likely to be.
    flags.popupAvoiderLREdge = 1;
    flags.popupAvoiderWidth = 0; // no avoider yet...

    // For static thumbs
    // http://cdn-2.nflximg.com/en_us/boxshots/large/60024022.jpg becomes
    // http://cdn-2.nflximg.com/en_us/boxshots/ghd/60024022.jpg
    // when not logged in, sign-up page needs to change 
    // https://netflix.hs.llnwd.net/e1/en_us/boxshots/large/70208522.jpg to
    //     // when not logged in, sign-up page has 
    // https://netflix.hs.llnwd.net/e1/en_us/boxshots/ghd/70208522.jpg
    let netflixRex1 = new RegExp("(/boxshots)/(large|small|tiny|[0-9]+)/");
    if (netflixRex1.test(aImageSrc)) {
      // popup for DVD box w/o play now.
      flags.popupAvoiderWidth = 392;
    }
    
    aImageSrc = aImageSrc.replace(netflixRex1, "$1/ghd/");

    let netflixRex2 = new RegExp("(\.nflximg.com/.*/kidscharacters)/(large|small|main|[0-9]+)/");
    aImageSrc = aImageSrc.replace(netflixRex2, "$1/cdp/");
    
    // For movie thumbs with "play" icons / links
    // Change http://movies.netflix.com/WiPlayer?movieid=70128681&amp;trkid=3651203&amp;nscl=1 to
    // http://cdn-1.nflximg.com/en_us/boxshots/ghd/70128681.jpg
    // and http://movies.netflix.com/WiMovie/Phineas_Ferb/70177007?trkid=4009636
    // to http://cdn-1.nflximg.com/en_us/boxshots/ghd/70177007.jpg
    let netflixRex3 = new RegExp(".*\\.netflix\\.com/WiPlayer\\?movieid=([0-9]+).*");
    let netflixRex4 = new RegExp(".*\\.netflix\\.com/WiMovie/.*/([0-9]+)\\?.*");
    if (netflixRex3.test(aImageSrc) || netflixRex4.test(aImageSrc)) {
      // large popup for "play now"
      flags.popupAvoiderWidth = 384;
    }
    aImageSrc = aImageSrc.replace(netflixRex3, "http://cdn-1.nflximg.com/en_us/boxshots/ghd/$1.jpg");
    aImageSrc = aImageSrc.replace(netflixRex4, "http://cdn-1.nflximg.com/en_us/boxshots/ghd/$1.jpg");
    
    return aImageSrc;
  }
};

/**
 * Flickr
 */
ThumbnailZoomPlus.Pages.Flickr = {
  key: "flickr",
  name: "Flickr",
  host: /^(.*\.)?(static)?flickr\.com$/,
  imageRegExp: /.*\.static\.?flickr\.com|l.yimg.com\/g\/images\/spaceout.gif/,
  //c2.staticflickr.com/8/7285/9040002362_8ee2a01c9c_z.jpg
  getImageNode : function(aNode, nodeName, nodeClass, imageSource) {
    
    /*
        spaceball:
        Images in the new Favorites page have a "spaceball" div
        node which overlaps the actual img.  The same happens for photos
        tagged as "The owner has disabled downloading of their photos".
        Find the actual img node to allow it to pop-up, as follows.  
        Ideally we'd like to detect when the photo is disabled for saving by
        the site so we could disable our own save, but I don't see how to tell
        that from the html.
    */
    if (/ui-display-shield|meta-bar|ui-bottom-gradient|spaceball/.test(nodeClass)) {
      ThumbnailZoomPlus.Pages._logger.debug("Flickr getImageNode: saw spaceball");
      let imgNodes = aNode.parentNode.getElementsByTagName("img");
      if (imgNodes.length > 0) {
        ThumbnailZoomPlus.Pages._logger.debug("Flickr getImageNode: returning " +
                                              imgNodes[0]);
      }
      return imgNodes[0];
    }
    
    // Not sure if this part still works.  I think it's for hovering
    // over the "i" more info icon.
    if (imageSource && -1 != imageSource.indexOf("spaceout.gif")) {
      ThumbnailZoomPlus.Pages._logger.debug("Flickr getImageNode: saw spaceout.gif");
      return aNode.parentNode.parentNode.firstChild.firstChild;
    }
    
    return aNode;
  },

  // for flickr.com
  getZoomImage : function(aImageSrc, node, flags) {
    // match an image name with a size code or no size code, e.g.
    // http://farm2.staticflickr.com/1120/1054724938_a67ff6eb04_s.jpg or
    // http://farm2.staticflickr.com/1120/1054724938_a67ff6eb04.jpg
    let rexSmall = new RegExp(/(?:_[ac-np-y])?(\.[a-z]+)(?:\?.*)?$/);
    let rexLarge = new RegExp(/(?:_[boz])(\.[a-z]+)(?:\?.*)?$/);
    
    // Substitute to the letter code for the desired size (_z=Medium_640).
    // It's tempting to use a code for a larger size, but some images aren't
    // available in larger size, causing them to get no popup at all if we change
    // it.
    // We'll change most single-letter size codes into "medium" (z), but
    // don't change the larger size codes of at least "medium" (rexLarge)
    if (rexLarge.test(aImageSrc)) {
      // it's already larger than the "medium" size we'd set it to.
      return aImageSrc;
    } else if (rexSmall.test(aImageSrc)) {
      return aImageSrc.replace(rexSmall, "_z$1");
    }
    return null;
  }
};

/**
 * Wikipedia
 */
ThumbnailZoomPlus.Pages.Wikipedia = {
  key: "wikipedia",
  name: "Wikipedia",
  host: /.*/,
  
  /*
     Examples:
       http://upload.wikimedia.org/wikipedia/en/thumb/e/ef/Indus_River_Delta.jpg/100px-Indus_River_Delta.jpg becomes
       http://upload.wikimedia.org/wikipedia/en/e/ef/Indus_River_Delta.jpg
       
       http://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Ernest_Hemingway_Kenya_safari_1954.png/100px-Ernest_Hemingway_Kenya_safari_1954.png becomes
       http://upload.wikimedia.org/wikipedia/commons/3/3f/Ernest_Hemingway_Kenya_safari_1954.png

       http://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Haute-Vienne-Position.svg/250px-Haute-Vienne-Position.svg.png becomes
       http://upload.wikimedia.org/wikipedia/commons/e/e6/Haute-Vienne-Position.svg   

       double extension:
       http://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Dannebrog.jpg/170px-Dannebrog.jpg.png
       
       also applies to many other mediawiki sites, e.g.
       http://torque-bhp.com/wiki/images/thumb/1/13/Diagnostic.jpg/180px-Diagnostic.jpg becomes
       http://torque-bhp.com/wiki/images/thumb/1/13/Diagnostic.jpg/800px-Diagnostic.jpg or
       http://torque-bhp.com/wiki/images/1/13/Diagnostic.jpg
       or
       http://wiki.the-big-bang-theory.com/images/thumb/2/2d/Kaley-Cuoco.jpg/140px-Kaley-Cuoco.jpg
       Others listed at http://s23.org/wikistats/largest_html.php?sort=users_desc&th=999&lines=999
   */
  imageRegExp: /\/thumb\/([^\/]+\/[^\/]+)\/(.*)\/[0-9]+px-\2(\.(png|jpg|gif))?$/i,
  
  getZoomImage : function(aImageSrc, node, flags) {
    aImageSrc = aImageSrc.replace(/\/thumb\/([^\/]+\/[^\/]+)\/(.*)\/[0-9]+px-\2.*/i,
                                  "/$1/$2");
    return aImageSrc;

    // Mediawiki software is used by many sites including wikipedia.  The latter has its
    // own page definition in this file, but perhaps they should be merged?
  }
};

/**
 * DeviantART
 */
ThumbnailZoomPlus.Pages.DeviantART = {
  // Change
  // https://s.deviantart.com/th/fs70/150/i/2011/244/0/2/they__ll_name_a_city_after_us_by_majdear-d48jvmu.jpg to
  // https://s.deviantart.com/th/fs70/i/2011/244/0/2/they__ll_name_a_city_after_us_by_majdear-d48jvmu.jpg
  // and
  // http://th06.deviantart.net/images/150/i/2003/47/c/5/aaa.jpg to
  // http://th06.deviantart.net/images/i/2003/47/c/5/aaa.jpg
  // Also
  // http://th06.deviantart.net/fs70/300W/f/2011/279/a/e/aaa.jpg
  // and
  // http://th04.deviantart.net/fs70/200H/f/2012/075/3/a/bake_a_cake_by_krisada-d4sz00q.jpg
  // also
  // http://t12.deviantart.net/sRf0b0MK6MEuQJQYxgTN6OgTsU8=/300x200/filters:fixed_height[...]origin()/pre00/3ebc/th/pre/i/2015/087/d/7/o_portrait_by_mshonak-d8ney6s.jpg becomes
  // http://pre00.deviantart.net/3ebc/th/pre/i/2015/087/d/7/o_portrait_by_mshonak-d8ney6s.jpg
  // also
  // http://t05.deviantart.net/b0YAlKidVoTAsW8LeLLjVMIB9lM=/300x200/filters:fixed_height%28100,100%29:origin%28%29/pre05/7ae2/th/pre/i/2015/087/a/5/wine_by_mshonak-d8ney7y.jpg
  // Note: doesn't currently work for gifs since multiple parts of their URLS change and
  // I don't know how to predict that, e.g.
  //   http://fc06.deviantart.net/fs70/i/2011/331/1/4/charmander_the_stray_by_brittanytucker-d4hijn7.gif to
  //   http://fc04.deviantart.net/fs70/f/2011/331/b/3/charmander_the_stray_by_brittanytucker-d4hijn7.gif
  // And note that the hover might be on the img or on a span which follows the img.
  key: "deviantart",
  name: "deviantART",
  host: /^(.*\.)?deviantart\.com$/,
  imageRegExp: /(th?[0-9]+|[as])\.deviantart\.(net|com)\/.*\/\d+[A-Za-z]?(\/[a-z])/,

  getImageNode : function(aNode, aNodeName, aNodeClass, imageSource) {
    let image = aNode;
    if ("span" == aNodeName  && /tt-/.test(aNodeClass) && aNode.previousSibling) {
      image = aNode.previousSibling;
    }
    return image;
  },

  getZoomImage : function(aImageSrc, node, flags) {
    let original = aImageSrc;
    aImageSrc = aImageSrc.replace(/:\/\/.*\.deviantart\.net\/.*\/.*\(\)\/pre([0-9]+)\//, "://pre$1.deviantart.net/");
    if (aImageSrc != original) {
      return aImageSrc;
    }
    aImageSrc = aImageSrc.replace(/\/\d+[A-Za-z]?(\/[fiop]\/[0-9])/, "$1");
    return aImageSrc;
  }
};

/**
 * OkCuid
 */
ThumbnailZoomPlus.Pages.OkCupid = {
  // Change http://ak3.okccdn.com/php/load_okc_image.php/images/60x60/60x60/531x24/1092x585/2/4433975072448026333.jpeg
  // to     http://ak3.okccdn.com/php/load_okc_image.php/images/4433975072448026333.jpeg
  key: "okcupid",
  name: "okCupid",
  host: /^.*\.okcupid\.com$/,
  imageRegExp: /^https?:\/\/[^\/]*\.okccdn\.com\/.*\/images\/.*\/[0-9]+\.(jpe?g|png|gif).*$/i,
  getZoomImage : function(aImageSrc, node, flags) {
    // http://ak1.okccdn.com/php/load_okc_image.php/images/160x160/160x160/189x210/687x708/2/17985133630795268990.jpeg
    let picRex = new RegExp(/^(.*\.okccdn\.com\/.*\/images\/)[0-9x\/]*\/([0-9]+\.(jpe?g|png|gif)).*$/);
    let image = (picRex.test(aImageSrc) ? aImageSrc.replace(picRex, "$1$2") : 
                 null);
    return image;
  }
};

/**
 * PhotoBucket
 */
ThumbnailZoomPlus.Pages.PhotoBucket = {
  key: "photobucket",
  name: "PhotoBucket",
  host: /^(.*\.)?photobucket\.com$/,
  imageRegExp: /\.photobucket.com\/(albums|groups)/,

  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/th_/);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/") : null);
        
    return image;
  }
};

/**
 * Pinterest
 */
ThumbnailZoomPlus.Pages.Pinterest = {
  key: "pinterest",
  name: "Pinterest",
  host: /^(.*\.)?pinterest\.com$/,
  
  // eg https://s-media-cache-ec4.pinimg.com/upload/165225880049687299_GEFs3cp0_b.jpg
  //    http://media-cache-ec9.pinterest.com/upload/76983474850615703_fCXJVbYR_f.jpg
  // http://media-cache-lt0.pinterest.com/192x/d4/12/36/d412365e2e3fb977ceaa0fbcfb0285f1.jpg
  imageRegExp: /.*\/(s-)?media-[^.\/]*\.(pinterest|pinimg)\.com\/([0-9]+x[0-9]*|upload|avatars)\/.*/,
  
  getImageNode : function(aNode, aNodeName, aNodeClass, imageSource) {
    let image = aNode;
    if ( ("div" == aNodeName  || "span" == aNodeName) && 
         ("hoverMask" == aNodeClass || "thumbImageWrapper" == aNodeClass) &&
        aNode.nextSibling) {
      image = aNode.parentNode.querySelector("img");
    } else if ( ("div" == aNodeName ) &&
         ("dimOverlay" == aNodeClass || "dimGradient" == aNodeClass)) {
      image = aNode.parentNode.parentNode.querySelector("img");
    }

    return image;
  },

  getZoomImage : function(aImageSrc, node, flags) {

    // for images:
    // eg seen at 
    //  http://pinterest.com/pin/98164466848180792/
    // https://pinterest.com/pin/76983474851009277/
    let rex = new RegExp("([0-9_a-zA-Z]+_)[tb](" + 
                         EXTS + ")");
    aImageSrc = aImageSrc.replace(rex, "$1f$2");

    // http://media-cache-lt0.pinterest.com/192x/d4/12/36/d412365e2e3fb977ceaa0fbcfb0285f1.jpg becomes
    // http://media-cache-lt0.pinterest.com/550x/d4/12/36/d412365e2e3fb977ceaa0fbcfb0285f1.jpg
    // also from http://media-cache-is0.pinimg.com/45x45/f4/18/de/f418de34daf273ceffddb07f641a5f55.jpg becomes
    aImageSrc = aImageSrc.replace(new RegExp("(\\.pinterest\\.com|\\.pinimg\\.com)/[0-9]+x(?:[0-9]*)(/.*" + EXTS + ")"),
                                  "$1/550x$2");
    
    // for avatars:
    // http://media-cache-ec2.pinimg.com/avatars/talkingincodes-20_75.jpg becomes
    // http://media-cache-ec2.pinimg.com/avatars/talkingincodes-20_o.jpg
    rex = new RegExp("(/avatars/.*)_[0-9]+(\\.jpg)$")
    aImageSrc = aImageSrc.replace(rex, "$1_o$2");
    
    return aImageSrc;
  }
};


/**
 * Tagged
 */
ThumbnailZoomPlus.Pages.Tagged = {
  key: "tagged",
  name: "Tagged",
  host: /^(.*\.)?tagged\.com$/,
  imageRegExp: /[a-z]+[0-9]+\.tagstat.com\/image/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/[123456789]0([\w-]+\.[a-z]+)/);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/00$1") : null);
    return image;
  }
};

/**
 * Last.fm
 */
ThumbnailZoomPlus.Pages.LastFM = {
  key: "lastfm",
  name: "Last.fm",
  host: /^(.*\.)?(last\.fm|lastfm.[a-z]+)$/,
  imageRegExp: /userserve-ak\.last\.fm\/serve/,
  getImageNode : function(aNode, aNodeName, aNodeClass, imageSource) {
    let image = aNode;
    if ("span" == aNodeName  && aNode.previousSibling) {
      if ("overlay" == aNodeClass) {
        image = aNode.previousSibling.firstChild;
      } else if ("jewelcase" == aNodeClass) {
        image = aNode.previousSibling;
      }
    }
    return image;
  },
  
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/serve\/\w+\//);
    let image =
      (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/serve/_/") : null);
    return image;
  }
};

/**
 * Google+ (Google Plus)
 */
ThumbnailZoomPlus.Pages.GooglePlus = {
  key: "googleplus",
  name: "Google+",
  host: /^(.*\.)?plus\.google\.com$/,

  // Note: the sz=48 or 32 or 24 case is the tiny thumb for which Google already has a popup which
  // shows a medium thumb and Add To Circles; we don't want our popup from that tiny one.
  // Also exclude */s-24c/photo.jpg, the profile menu button.
  imageRegExp: /\.(ggpht|googleusercontent)\.com\/(?!.*photo\.jpg\?sz=(24|32|48))(?!.*\/s24-c\/photo\.jpg).*/,
  
  _logger: ThumbnailZoomPlus.Pages._logger,
  
  getZoomImage : function(aImageSrc, node, flags) {

    // example profile pic link: https://lh3.googleusercontent.com/-TouICNeczXY/AAAAAAAAAAI/AAAAAAAAAf8/eS42KCD74YM/photo.jpg?sz=80
    // example image link: https://lh3.googleusercontent.com/-TouICNeczXY/AAAAAAAAAAI/AAAAAAAAAf8/eS42KCD74YM/photo.jpg

    let rex3 = new RegExp(/\/photo\.jpg\?sz=([0-9]+)$/);
    if (rex3.test(aImageSrc)) {
      this._logger.debug("matched google+ profile pic");
      return aImageSrc.replace(rex3, "/photo.jpg");
    }
    
    // example photo thumb:       https://lh6.googleusercontent.com/-sHGfoG3xxXX/TnlXXz7dHmI/AAXXAAAAAI8/upXXI3JTguI/w402/065.JPG
    // corresponding large image: https://lh6.googleusercontent.com/-sHGfoG3xxXX/TnlXXz7dHmI/AAXXAAAAAI8/upXXI3JTguI/065.JPG
    // the w402 field supports arbitrary width, height, and size specifications with
    // w###, h###, s###.  I've also seen a "-k" suffix.
    //
    let rex1 = new RegExp(/\/(([swh][0-9]+|-[a-z])-?)+\//);
    if (rex1.test(aImageSrc)) {
      this._logger.debug("matched google+ non-profile photo");
      return aImageSrc.replace(rex1, "/");
    }

    // Google Plus Photos
    // https://lh3.googleusercontent.com/pNJgHstijFQy_mJdJ4JAD991jC_KL1458ytz9z-Mf8Q=w484-h272-p-no scales up
    // w and h dimensions.
    let rex4 = /^(.*)=w([0-9]+)-h([0-9]+)-(.*)$/;
    var match = rex4.exec(aImageSrc);
    if (match) {
        var width = 0 + match[2];
        var height = 0 + match[3];
        // Scale up larger dimension to at least DESIRED pixels, preserving aspect.
        var DESIRED = 1200;
        if (width < DESIRED && height < DESIRED) {
            if (width > height) {
              height = Math.floor((height * DESIRED) / width);
              width = DESIRED;
            } else {
                width = Math.floor((width * DESIRED) / height);
                height = DESIRED;
            }
        }
        aImageSrc = match[1] + "=w" + width + "-h" + height + "-" + match[4];
        return aImageSrc;
    }
    
    // example shared link thumb: https://images2-focus-opensocial.googleusercontent.com/gadgets/proxy?url=http://www.avantmusicnews.com/wp-content/themes/weaver/images/headers/sunset.jpg&container=focus&gadget=a&rewriteMime=image/*&refresh=31536000&resize_h=120&no_expand=1
    // corresponding image: http://www.avantmusicnews.com/wp-content/themes/weaver/images/headers/sunset.jpg
    let rex2 = /.*gadgets\/proxy\?url=([^&]+).*/;
    if (rex2.test(aImageSrc)) {
      // Extract the image's URL, which also needs to be url-unescaped.
      this._logger.debug("matched google+ shared URL");
      aImageSrc = aImageSrc.replace(rex2, "$1");
      aImageSrc = unescape(aImageSrc);
      return aImageSrc;
    }
    
    this._logger.debug("did not match any google+ URL");
    return null;
  }
};

/**
 * Gmail
 */
ThumbnailZoomPlus.Pages.GMail = {
  key: "gmail",
  name: "GMail",
  host: /^(.*\.)?mail\.google\.com$/,
  imageRegExp: /\/mail.google.com\/mail\/.*&view=att.*&disp=thd/,
  
  getZoomImage : function(aImageSrc, node, flags) {
    // change:
    // https://mail.google.com/mail/u/0/?ui=2&ik=4ed1eeeaae&view=att&th=133f51e77a267265&attid=0.1&disp=thd&realattid=f_gvmhze0k1&zw to
    // https://mail.google.com/mail/u/0/?ui=2&ik=4ed1eeeaae&view=att&th=133f51e77a267265&attid=0.1&disp=inline&realattid=f_gvmhze0k1&zw
    let rex1 = new RegExp(/(.*)&disp=thd(.*)/);
    if (rex1.test(aImageSrc)) {
      return aImageSrc.replace(rex1, "$1&disp=inline$2");
    }
    return null;
  }
};

/**
 * Google (Google Images)
 */
ThumbnailZoomPlus.Pages.Google = {
  key: "google",
  name: "", // Set in ENTITY_page_google.
  
  // host is all of Google so it can work on images.google.com, 
  // www.google.com general search with image results, etc.
  // To prevent this from interfering with GooglePlus, its entry
  // comes later in filterService.js.
  host: /^((?!picasaweb).*\.google(\.com)?\.[a-z]+)$/,  
  imageRegExp: /^https?:\/\//,
  
  getImageNode : function(node, nodeName, nodeClass, imageSource) {
    return node.parentNode;
  },

  getZoomImage : function(aImageSrc, node, flags) {
    let imgurlEx = new RegExp(/.*[\?&]img_?url=([^&]+).*$/);
    if (imgurlEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(imgurlEx, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
      aImageSrc = decodeURIComponent(aImageSrc);
      if (! /^https?:\/\/./.test(aImageSrc)) {
        aImageSrc = "http://" + aImageSrc;
      }
    } else {
      if (! EXTS_RE.test(aImageSrc)) {
        aImageSrc = null;
      }
    }
    return aImageSrc;
  }
};

/**
 * YouTube
 */
ThumbnailZoomPlus.Pages.YouTube = {
  key: "youtube",
  name: "YouTube",
  host: /^(.*\.)?(nsfw)?youtube\.com|i[0-9]*\.ytimg\.com$/,
  imageRegExp: /i[0-9]*\.ytimg\.com\/vi\//,
  // see also "Others" rule.
  
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/default\./);
    if (rex.test(aImageSrc)) {
      flags.setVideoBorderColor(aImageSrc, "youtube");
      return aImageSrc.replace(rex, "/hqdefault.");
    }
    return null;
  }
};

/**
 * Daily Mile
 */
ThumbnailZoomPlus.Pages.DailyMile = {
  key: "dailymile",
  name: "Daily Mile",
  host: /^(.*\.)?dailymile\.com$/,
  imageRegExp: /(dmimg|dailymile)\.com\/(images|pictures|photos)\//,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/_(mini|profile|preview|avatar)\./);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, ".") : aImageSrc);
    return image;
  }
};

/**
 * IMDb
 */
ThumbnailZoomPlus.Pages.IMDb = {
  key: "imdb",
  name: "IMDb",
  host: /^(.*\.)?imdb\.[a-z]+$/,
  imageRegExp: /ia\.media\-imdb\.com\/images\//,
  getZoomImage : function(aImageSrc, node, flags) {
    // http://ia.media-imdb.com/images/M/MV5BMTk4MTMwMDgzN15BMl5BanBnXkFtZTcwOTI1MTc0OA@@._V1._SX32_CR0,0,32,44_.jpg becomes
    // http://ia.media-imdb.com/images/M/MV5BMTk4MTMwMDgzN15BMl5BanBnXkFtZTcwOTI1MTc0OA@@._V1._SY800.jpg
    // Note that removing ._V1._SX500.jpg would give even bigger images, but
    // they are sometimes much bigger than wanted, and load slowly.  So we stick with
    // 500-across images.
    aImageSrc = aImageSrc.replace(/\._.+_(\.[a-z]+)/i,
                                  "._V1._SY800$1");
    return aImageSrc;
  }
};

/**
 * Imgur images (not galleries)
 */
ThumbnailZoomPlus.Pages.Imgur = {
  key: "imgur",
  name: "Imgur",
  host: /^(.*\.)?imgur\.com$/,
  imageRegExp: /(i\.)?imgur\.com\//,
  
  isLinkedToImgurGallery : function(aImageSrc, node) {
    var linkNode = ThumbnailZoomPlus.Pages.Others.getImageNode(node, node.localName, node.className, aImageSrc);
    if (linkNode && /\/gallery\//.test(linkNode.getAttribute("href"))) {
      ThumbnailZoomPlus.debugToConsole("ThumbnailPreview: Imgur.isLinkedToImgurGallery: is enclosed in link to " +
                         linkNode.getAttribute("href"));
      return true;
    }
    return false;
  },
  
  getZoomImage : function(aImageSrc, node, flags) {
    if (this.isLinkedToImgurGallery(aImageSrc, node)) {
      // Don't show a pop-up based on the thumb's image if we're inside an imgur
      // galley link.  Instead let Others (Indirect) handle it, since it may be
      // a multi-image gallery which the imgur rule can't handle.
      // On imgur.com itself all thumbs seem to be in such links, so the imgur
      // rule may end up activating only on imgur thumbs on other sites.
      return null;
    }

    let rex = new RegExp(/(imgur\.com\/[a-z0-9]{5,7})[bsm](\.[a-z]+)(\?.*)?/i);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1$2") : null);
    return image;
  }
};

/**
 * Photosight.ru and Photosight.com
 *
 * ex1:
 * http://s.photosight.ru/img/4/aef/4167500_icon.jpg or ..._thumb
 * http://s.photosight.ru/img/4/aef/4167500_large.jpg
 * ex2:
 * http://img-1.photosight.ru/e68/4167692_top_of_day.jpg
 * http://img-1.photosight.ru/e68/4167692_large.jpg
 * ex3:
 * http://s.photosight.ru/img/5/7bd/4167881_crop_1.jpeg
 * http://s.photosight.ru/img/5/7bd/4167881_large.jpeg
 *
 * ex4 (for very old images):
 * http://prv-2001-04.photosight.ru/03/pv_26.jpg
 * http://img-2001-04.photosight.ru/03/26.jpg
 *
 * http://www.photosight.com/prv/2012/05/09/pv_1612453.jpg becomes
 * http://images.photosight.com/2012/05/09/1612453.jpg
 */
ThumbnailZoomPlus.Pages.Photosight = {
  key: "photosight",
  name: "Photosight",
  host: /^(.*\.)?photosight\.(ru|com)$/i,
  imageRegExp: /\.photosight\.(ru|com)/i,
  
  getImageNode : function(aNode, nodeName, nodeClass, imageSource) {
    if (aNode.localName.toLowerCase() == "a") {
      aNode = aNode.querySelector("div");
    }
    return aNode;
  },

  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/_(thumb|icon)\./);
    let rex2 = new RegExp(/_(crop)_[0-9]+\./);
    let rex3 = new RegExp(/_top_of_day\./);
    let rex4 = new RegExp("//prv-(.*/)pv_([0-9]+\\.)");
    let rex5 = new RegExp("//www.photosight.com/prv/(.*/)pv_([0-9]+\\.)");
    let image = 
      rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "_large.") :
      rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "_large.") :
      rex3.test(aImageSrc) ? aImageSrc.replace(rex3, "_large.") : 
      rex4.test(aImageSrc) ? aImageSrc.replace(rex4, "//img-$1$2") :
      rex5.test(aImageSrc) ? aImageSrc.replace(rex5, "//images.photosight.com/$1$2") :
      null;
    
    return image;
  }
};

/**
 * Fotop.net
 */
ThumbnailZoomPlus.Pages.Fotop = {
  key: "fotop",
  name: "Fotop.net",
  host: /^(.*\.)?fotop\.net$/i,
  imageRegExp: /\.fotop\.net/i,
  
  getZoomImage : function(aImageSrc, node, flags) {
    // change *.thumb.jpg to *.jpg
    let image = aImageSrc.replace(/\.thumb(\.[a-z]+)$/, "$1");
    
    // http://temp3.fotop.net/albums2/cathysin/.pj/tnMFNFs0t.jpg becomes
    // http://temp3.fotop.net/albums2/cathysin/.pj/tnMFNFs0.jpg
    image = image.replace(/(\/.pj\/[^.\/]+)t\./, "$1.");
    
    // change http://temp3.fotop.net/albums7/NoirSaya/.a/t4bc5f5bd9883a.jpg
    // to http://temp3.fotop.net/albums7/NoirSaya/.a/4bc5f5bd9883a.jpg
    image = image.replace(/\/\.a\/t([^.\/]*\.)/, "/.a/$1");
    
    return image;
  }
};

/**
 * Engadget
 */
ThumbnailZoomPlus.Pages.Engadget = {
  key: "engadget",
  name: "Engadget",
  host: /^(.*\.)?engadget\.[a-z]+$/,
  imageRegExp: /_[0-9]+x[0-9]+\.[a-zA-Z]+$/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/_[0-9]+x[0-9]+(\.[a-zA-Z]+)$/i);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1") : null);
    return image;
  }
};


/**
 * Others: this is for arbitrary sites which link directly to image files
 * and other situations for which we can determine an image linked from
 * an arbitrary site.
 */
ThumbnailZoomPlus.Pages.Others = {
  key: "others",
  name: "", // Set in ENTITY_page_others.
  host: /.*/,
  preferLinkOverThumb: true,
  
  /*
     A note about imgur.com URLs:
     - imgur.com/a/ is an html page of an album (hosting multiple images).
     - imgur.com/gallery/ is an html page of a single image or an album (you
       can't tell which from the URL).
     - Album links typically but not always appear e.g. on reddit.com in /a/ form.
  */

  // imgur.com links (except imgur.com/a/) w/o image type suffix give page containing image.
  // Allow that; we'll add suffix in getZoomImage.  Also allow youtube links,
  // which getZoomImage will convert to a youtube thumb.
  // Note that we can't support imgur.com/a/ links (albums) here since there is no
  // image named similarly to the link, but we do in OthersIndirect.

  imageRegExp: new RegExp(
      EXTS + "([?&].*)?$"
    + "|tumblr.com/(photo/|tumblr_)"
    + "|imgur\\.com/(?!gallery|tools|signin|register|tos$|contact|removalrequest|faq$)[^/&\\?]+(&.*)?$"
    + "|imgbox\\.com/[^/]+/?$"
    + "|((nsfw)?youtube\\.com|youtu.be)/(watch|embed)"
    + "|/youtu.be/[^/]+$"
    + "|quickmeme\\.com/meme/"
    + "|someimage.com/."
    + "|http://www\\.livememe\\.com/..."
    + "|qkme.me/"
    + "|^https?://memegenerator.net/instance/"
    + "|/index.php\?.*module=attach" // IP.board, eg rootzwiki.com
    + "|^(https?://(.*\\.)?twitpic.com/)(?!(upload))([a-z0-9A-Z]+)$"
    + "|^https?://twitter.com/.*\\?url=(http[^&]+)(&.*)?$"
    + "|^https?://([^/?&]*\.)?fotoblur\.com/images/[0-9+]"
    + "|[\?&]img_?url="
    + "|(https?)://(?!(?:www|today|groups|muro|chat|forum|critiques|portfolio|help|browse)\\.)([^/?&.])([^/?&.])([^/?&.]*)\\.deviantart\\.com/?$"
    + "|stumbleupon.com\/(to|su)\/[^\/]+\/(.*" + EXTS + ")"
    + "|^https?:\/\/([^/]*\.)?viddy\.com\/(play/)?video\/[^\/?]+"
    + "|^https?://(instagr\\.am|instagram\\.com)/p/.*/media/"
    + "|^https?://yfrog\\.com/.*:(tw.*|iphone)"
    + "|^https?://.*picsarus\\.com/[a-zA-Z0-9]+$"
    + "|^https?://webm\.land\/w\/"
    + "|(?:i\.)?gyazo.com/[a-z0-9]{32}\.gif"
    + "|//giphy\\.com/gifs/[^/?]+"
    + "|\.wallhaven\.cc/wallpaper/[0-9]+"
    // end
    , "i"),
  
    imageDisallowRegExp: new RegExp(
      // We disallow certain sites where
      // we know an image-link link is really an html page (such as an imgur gallery).
      "^https?:\/\/([^/]*\.)?(imgur\\.com/(?:a|gallery)/|image.aven\\.net/img\\.php|image.enue\\.com/img\\.php)"
    // end
    , "i"),
                          

  _logger: ThumbnailZoomPlus.Pages._logger,
  
  // For "Others"
  getImageNode : function(aNode, nodeName, nodeClass, imageSource) {
  
    if (/itemLabel/.test(nodeClass)) {
      // Prohibit popup from the "Download" menu item in a Facebook album
      // in grid view.
      return null;
    }
    
    let imgNode = null;
    let imgNodeURL = null;
    if (aNode.localName.toLowerCase() == "img") {
      imgNode = aNode;
      imgNodeURL = aNode.getAttribute("src");
    }

    // try to find an enclosing <a> (link) tag.
    while (aNode != null) {
      let name = aNode.localName;
      if (name == null) {
        aNode = null;
        break;
      }
      name = name.toLowerCase();
      if (name == "frame" || name == "iframe" || name == "body") {
        // failed to find anything.
        aNode = null;
        break;
      }
      if (aNode.localName.toLowerCase() == "a") {
        // found enclosing link.
        break;
      }
      this._logger.debug("ThumbnailPreview: Others: trying parent of " + aNode.localName);
      aNode = aNode.parentNode;
    }
    this._logger.debug("ThumbnailPreview: Others: found node " + aNode);

    // For tumblr.com:
    let tumblrRegExp = new RegExp("\\.tumblr\\.com/(photo/|tumblr_)", "i");
    if (tumblrRegExp.test(imgNodeURL)) {
      // Tumblr dashboard when Full Images is off doesn't link to the full-size
      // images.  The img node has id="thumbnail_photo_1234567890", and
      // the <a> node linking to the high-res image has id="high_res_link_1234567890"
      let id=imgNode.id;
      id = id.replace("thumbnail_photo_", "high_res_link_");
      let related = id ? imgNode.ownerDocument.getElementById(id) : null;
      this._logger.debug("Others: related ID=" + id + "; related=" +
                         String(related));
      if (related && related.getAttribute("href") != "") {
          imgNodeURL = related.getAttribute("href");
          aNode = related;
          this._logger.debug("Others: detected tumblr high-rez link " +
                             String(aNode));
      }
      
      // Special hack for tumblr: tumblr often uses thumbs which have links, where
      // the thumb itself could be shown larger and the link may point to
      // a non-image such as another tumblr's blog.  So we'd rather use the 
      // thumb's image itself as our node than its link.  This is especially
      // useful when the images are larger than the embedded size, e.g. when
      // viewing tumblr zoomed out.
      //
      // TODO: The more general way to handle this would be to return both the
      // link's node and the image's node, but the framework doesn't currently
      // let us return multiple.  The general approach would let us remove the
      // tumblr-specific code and work better on all sites.
      let tumblrOrPhotoRegExp = 
        new RegExp("\\.tumblr\\.com/(photo/|tumblr_).*" +
                   "|(.*" + EXTS + ")" +
                   "|fotoblur\.com/images/[0-9]+", "i");
      if (// We disallow assets.tumblr.com, e.g. the "dashboard" button, and tiny thumbs.
          ! /assets\.tumblr\.com/.test(imgNodeURL) &&
          ! /_75sq\./.test(imgNodeURL) &&
          // test the link node's URL to see if it's an image:
          (aNode == null || ! tumblrOrPhotoRegExp.test(String(aNode))) ) {
        this._logger.debug("Others: detected tumblr; using thumb as image, node "
                           + imgNode + " " + imgNodeURL);
        
        return imgNode;
      }
    }
    
    return aNode;
  },
  
  // For "Others"
  getZoomImage : function(aImageSrc, node, flags) {
    /*
       The rules here transform various kinds of link URLs into links to images.
       The simplest case is a link which already refers directly to a *.jgp or
       other image.
       
       Cases which are tested first is cases which transform a URL into a
       different URL, which may be the URL of an image or a URL which can
       be processed by the rules after it to produce an image.  An 
       example is a stumbleupon link or deviantart link which refers to
       a YouTube video.  The stumbleupon rule turns it into a youtube URL,
       and then the youtube rule turns it into a jpg.
     */
    
    var before;
    
    if (/^https?:\/\/[^\/]*\.wiki(?:media|pedia)\.org\/wiki\//i.test(aImageSrc)) {
      // wikipedia page URLs look like image URLs but they aren't.  We don't
      // support showing images for wiki page links, but the Wikipedia rule does
      // support wikipedia *thumbnails*.
      // example: http://commons.wikimedia.org/wiki/File:Prinsengracht.jpg
      return null;
    }
    
    if (/^https?:\/\/photo\.xuite\.net\/./.test(aImageSrc)) {
      // Prohibit using links from photo.xuite.net since they look like
      // .jpg URLs but are really html.  By rejecting them here we let the
      // Thumbnails rule handle them.
      return null;
    }
     
    if (/:\/\/[a-z0-9]+\.facebook\.com\/photo\.php/i.test(aImageSrc)) {
      return null;
    }
    
    // For StumbleUpon.com links, change
    // http://www.stumbleupon.com/to/3roKbh/content.mindcrap.com/gallery/dogs/15/34.jpg/t:7ed1a2cbdd70f;src:all or
    // http://www.stumbleupon.com/su/3roKbh/content.mindcrap.com/gallery/dogs/15/34.jpg to
    // http://content.mindcrap.com/gallery/dogs/15/34.jpg
    let stumbleUponEx = new RegExp(/^(.*\.)?stumbleupon.com\/(to|su)\/[^\/]+\/(.*?)(\/t:[0-9a-f]+;.*)?$/);
    if (stumbleUponEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(stumbleUponEx, "http://$3");
      aImageSrc = decodeURIComponent(aImageSrc);
      aImageSrc = decodeURIComponent(aImageSrc);
    }

    // For google images links, google video search, images.yandex.ru, startpage.com,
    // and some others, get URL from imgurl=... part.
    let imgurlEx = new RegExp(/.*[\?&](?:img_?url|url|oiu)=([^&]+).*$/);
    if (imgurlEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(imgurlEx, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
      if (! /^https?:\/\/./.test(aImageSrc)) {
        aImageSrc = "http://" + aImageSrc;
      }
    }

    // overstock.com:
    // http://ak1.ostkcdn.com/images/products/3962805/Ultra-Non-slip-Rug-Pad-8-x-10-P11996894.jpg becomes
    // http://ak1.ostkcdn.com/images/products/3962805/Ultra-Non-slip-Rug-Pad-8-x-10-L11996894.jpg
    aImageSrc = aImageSrc.replace(/(\/\/ak[0-9]+\.ostkcdn\.com\/images\/.*[-\/])[TP]([0-9]+\.jpe?g.*)/, "$1L$2");

    // someimage.com
    // http://someimage.com/TkscG18 becomes
    // http://i1.someimage.com/TkscG18.jpg (but it doesn't always work)
    aImageSrc = aImageSrc.replace(/\/\/(someimage\.com\/[^\/?]+)$/,
                                  "//i1.$1.jpg");

    // wallhaven.cc
    aImageSrc = aImageSrc.replace(/[a-zA-Z0-9]+\.wallhaven\.cc\/wallpaper\/([0-9]+)/,
                                  "wallpapers.wallhaven.cc/wallpapers/full/wallhaven-$1.jpg");
  
    // For ixquick.com image search:
    // https://s3-us4.ixquick-proxy.com/do/show_picture.pl?l=english&cat=pics&c=pf&q=cat&h=1080&w=1920&th=90&tw=160&
    //     fn=1562-cute-little-cat.jpg&fs=452.3%20k&el=boss_pics_2&
    //     tu=http:%2F%2Fts4.mm.bing.net%2Fimages%2Fthumbnail.aspx%3Fq%3D4585398013789143%26id%3Dc80ac415cdae0b434fe400624ec8ae33&
    //     rl=NONE&
    //      u=http:%2F%2Fwww.freegreatpicture.com%2Fkitty%2Fcute-little-cat-1562&
    //  udata=8dac58999bb7352e104708d239982b4b&
    //    rid=LDLNOSRLOKLK&
    //    oiu=http:%2F%2Fwww.freegreatpicture.com%2Ffiles%2F157%2F1562-cute-little-cat.jpg
    // becomes
    // http://www.freegreatpicture.com/files/157/1562-cute-little-cat.jpg
    let ixquickEx = new RegExp(/.*ixquick(?:-proxy)?\.com\/do\/show_picture\.pl.*&oiu=([^&]+).*$/);
    if (ixquickEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(ixquickEx, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
    }    
    
    // https://www.facebook.com/l.php?u=http%3A%2F%2Fi.imgur.com%2FmLR3d.jpg
    let rexFBExternal = /.*\.facebook\.com\/l\.php\?(?:.*&)?u=([^&]+).*/;
    if (rexFBExternal.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(rexFBExternal, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
    }

    // Deviantart external links: change
    // http://www.deviantart.com/users/outgoing?http://www.youtube.com/watch?v=DLQBAOomHzq to
    // http://www.youtube.com/watch?v=DLQBAOomHzq
    let deviantOutgoingRex = new RegExp("https?://[^\\.]+\\.deviantart\\.com/.*/outgoing\\?(.*)");
    aImageSrc = aImageSrc.replace(deviantOutgoingRex, "$1");

    // Deviantart profile links:
    // Change link
    // http://truong-abcdef.deviantart.com/ to
    // http://a.deviantart.net/avatars/t/r/truong-san.jpg?1 (/t/r/ are from the 1st 2 letters)
    // We unfortunately have to assume either jpg or gif.
    let deviantProfileRex = new RegExp("(https?)://([^/?&.])([^/?&.])([^/?&.]*)\\.deviantart\\.com/?$");
    aImageSrc = aImageSrc.replace(deviantProfileRex, "$1://a.deviantart.net/avatars/$2/$3/$2$3$4.jpg?1");
    
    // picsarus.com
    aImageSrc = aImageSrc.replace(/^(https?:\/\/.*picsarus\.com\/[a-zA-Z0-9]+)$/, "$1.jpg");

    // For twitter links like https://twitter.com/#!/search/picture/slideshow/photos?url=https%3A%2F%2Fp.twimg.com%2FAe0VPNGCIAIbRXW.jpg
    let twitterEx = new RegExp("^https?://twitter.com/.*\\?url=([^&]+)(&.*)?$");
    aImageSrc = decodeURIComponent(aImageSrc.replace(twitterEx, "$1"));
    
    // For links to twitpic pages, chage
    // http://twitpic.com/10l4j4.jpg to
    // http://twitpic.com/show/full/10l4j4  (or .../large/...)
    let twitpicEx = new RegExp("^(https?://(.*\\.)?twitpic.com/)([^\\./]+)$");
    aImageSrc = aImageSrc.replace(twitpicEx, "$1/show/full/$3");
    
    // For google.com/url?v= for youtube.com:
    // http://www.google.com/url?q=http://www.youtube.com/watch%3Fv%3Dr6-SJLlneLc&sa=X&ei=JMh-T__sEcSviAKIrLSvAw&ved=0CCEQuAIwAA&usg=AFQjCNEl2fsaLGeItGZDrJ0U_IEPghjL0w to
    // http://www.youtube.com/watch?v%=r6-SJLlneLc&sa=X&ei=JMh-T__sEcSviAKIrLSvAw&ved=0CCEQuAIwAA&usg=AFQjCNEl2fsaLGeItGZDrJ0U_IEPghjL0w
    let youtube2Ex = new RegExp("^(?:https?://)(?:[^/]*\\.)?google\\.com/url(?:\\?.*)?[?&]q=([^&]*).*$");
    aImageSrc = decodeURIComponent(aImageSrc.replace(youtube2Ex, "$1"));

    // For youtube links, change 
    // http://www.youtube.com/watch?v=-b69G6kVzTc&hd=1&t=30s to 
    // http://i3.ytimg.com/vi/-b69G6kVzTc/hqdefault.jpg
    // http://youtu.be/kuX2lI84YRQ to
    // http://i3.ytimg.com/vi/kuX2lI84YRQ/hqdefault.jpg
    // http://www.youtube.com/embed/87xNpOYOlQ4?rel=0 to
    // http://i3.ytimg.com/vi/87xNpOYOlQ4/hqdefault.jpg
    let youtubeEx = new RegExp("(https?://)(?:[^/]*\\.)?(?:youtube\\.com|nsfwyoutube\\.com|youtu\\.be).*(?:v=|/)([^?&#!/]+)[^/]*/*$");
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(youtubeEx, "$1i3.ytimg.com/vi/$2/hqdefault.jpg");
    if (before != aImageSrc) {
      flags.setVideoBorderColor(aImageSrc, "youtube in \"Others\"");
    }
    
    // for anon..: change ...img.php?path=http://... to http://...
    aImageSrc = aImageSrc.replace(/.*img\.php\?path=/, "");
    
    // For blogger aka Blogspot, change
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s500/DSC_0043.JPG to
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s1600/DSC_0043.JPG; change
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s320-p/Tiara+Riley.jpeg to
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s1600-p/Tiara+Riley.jpeg
    // NOTE: This rule exists in both Others and Thumbnails, and should be the same in both.
    let blogspotRegExp = new RegExp("(\\.(blogspot|blogger)\\.com/.*)/s[0-9]+(-[a-z])?/([^/?&]+\.[^./?&]*)$");
    aImageSrc = aImageSrc.replace(blogspotRegExp, "$1/s1600/$4");

    // memegenerator.net:
    // http://memegenerator.net/instance/21284704?.. becomes
    // http://cdn.memegenerator.net/instances/600x/21284704.jpg
    aImageSrc = aImageSrc.replace(/^(https?:\/\/)memegenerator\.net\/instance\/([0-9]+)([?\/].*)?$/i,
                                  "$1cdn.memegenerator.net/instances/600x/$2.jpg");

    // livememe.com:
    // http://www.livememe.com/84ak9a9 becomes
    // http://i.lvme.me/84ak9a9.jpg
    aImageSrc = aImageSrc.replace(/^(https?:\/\/)(?:www\.)?livememe\.com\/([^\/]+)$/,
                                  "$1i.lvme.me/$2.jpg");
    
    // If imgur link, remove part after "&" or "#", e.g. for https://imgur.com/nugJJ&yQU0G
    // Take just the first image if multiple as https://imgur.com/nugJJ&yQU0G,308472a,va204a1
    let imgurRex = new RegExp(/(imgur\.com\/)([^\/&#,]+)([&#][^,]*)?.*/);
    aImageSrc = aImageSrc.replace(imgurRex, "$1$2");

    let quickmemeEx = new RegExp(/(?:www\.quickmeme\.com\/meme|(?:i\.)?qkme\.me)\/([^\/\?]+).*/);
    aImageSrc = aImageSrc.replace(quickmemeEx, "i.qkme.me/$1");
  
    // fotoblur.com: change
    // http://www.fotoblur.com/images/389235 to
    // http://www.fotoblur.com/api/resize?id=389235&width=1280&height=1024
    aImageSrc = aImageSrc.replace(/^(https?:\/\/[^\/?]*fotoblur\.com)\/images\/([0-9]+).*/,
                                  "$1/api/resize?id=$2&width=1280&height=1024");
    
    // viddy.com (see also in Thumbnail rule)
    // http://www.viddy.com/video/a35a8581-7c0f-4fd4-b98f-74c6cf0b5794 becomes
    // http://cdn.viddy.com/images/video/a35a8581-7c0f-4fd4-b98f-74c6cf0b5794.jpg
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(/^(https?:\/\/)(?:[^\/]+\.)?viddy\.com\/(?:play\/)?video\/([^\/?]+).*/i,
                                  "$1/cdn.viddy.com/images/video/$2.jpg");
    if (before != aImageSrc) {
      flags.setVideoBorderColor(aImageSrc, "viddy.com");
    }
    
    // imgchili.com: 
    // http://imgchili.com/show/7428/9998984_ie_011.jpg becomes
    // http://i2.imgchili.com/7428/9998984_ie_011.jpg
    aImageSrc = aImageSrc.replace(/:\/\/imgchili\.(?:com|net)\/show\//, "://i2.imgchili.com/");
    aImageSrc = aImageSrc.replace(/(\/\/img..g\.com)\/\?v=/i, "$1/images/");
    aImageSrc = aImageSrc.replace(/.*\.any\.gs\/url\/(.*)/, "$1");

    // http://webm.land/w/eMmD/ becomes http://webm.land/media/eMmD.webm
    aImageSrc = aImageSrc.replace(/:\/\/webm\.land\/w\/([^\/?]+).*/, "://webm.land/media/$1.webm");

    // imgbox.com:
    // http://imgbox.com/dAwF3YOJ becomes
    // http://i.imgbox.com/dAwF3YOJ
    aImageSrc = aImageSrc.replace(/:\/\/imgbox\.com\/([^/]+)$/, "://i.imgbox.com/$1");
    
    // dropbox:
    // https://www.dropbox.com/s/3tpngbyy77q57e5/2011-03-07%2015.28.14.jpg?dl=0 becomes
    // https://www.dropbox.com/s/3tpngbyy77q57e5/2011-03-07%2015.28.14.jpg?dl=1
    aImageSrc = aImageSrc.replace(/(dropbox\.com\/.*[?&])dl=0/, "$1dl=1");
    
    // We can't display imgur's gifv's (which are mp4's and require Flash) but
    // imgur can usually serve a webm, which we can display.  So request that.
    aImageSrc = aImageSrc.replace(/(imgur\.com\/.*)\.gifv/, "$1.webm");
    
    // http://giphy.com/gifs/xXuQz6usY7gKk becomes
    // http://media.giphy.com/media/xXuQz6usY7gKk/giphy.gif and
    // http://giphy.com/gifs/star-wars-bloopers-wJqqUvFprCoTK becomes
    // http://media.giphy.com/media/wJqqUvFprCoTK/giphy.gif not
    // http://giphy.com/media/C7mPxCn8CAH1m/giphy.gif
    aImageSrc = aImageSrc.replace(/\/\/giphy\.com\/gifs\/(?:.*-)?([^-\/?]+)/, "//media.giphy.com/media/$1/giphy.gif");
    
    // For most sites, if there is no image suffix, add .jpg.  The rex below
    // matches exceptions (where an image may not contain an image suffix).
    let rex = new RegExp(  "tumblr\\.com/.*"
                         + "|twimg[.0-9-]"
                         + "|twitpic\\.com"
                         + "|(" + EXTS + "([?&].*)?$)"
                         + "|^https?://(instagr\\.am|instagram\\.com)/p/.*/media/"
                         + "|^https?://yfrog\\.com/.*:(tw.*|iphone)"
                         , "i");
    let isImage = rex.test(aImageSrc);
    if (! isImage) {
      // add .jpg, e.g. for imgur links, if it doesn't appear anywhere 
      // (including stuff.jpg?more=...)
      aImageSrc += ".jpg";
    }
    this._logger.debug("Others getZoomImage: using zoom image " + aImageSrc);

    return aImageSrc;
  }
};

/**
 * _getZoomImageViaPage() tries to improve upon aImageSrc using the getZoomImage
 * of the specified page number (if it matches aImageSrc).  Node is some
 * node related to the image, but may not be a very good one
 * (some non-null node is required to satisfy getZoomImage).
 *
 * Returns the possibly improved URL.  Example:
 *   result = this._getZoomImageViaPage(ThumbnailZoomPlus.Pages.Flickr.aPage, result);
 */
let _getZoomImageViaPage = function(aPage, node, aImageSrc) {
  if (ThumbnailZoomPlus.FilterService.filterImage(aImageSrc, aPage)) {
    let pageInfo = ThumbnailZoomPlus.FilterService.pageList[aPage];
    let flags = {};
    let betterResult = pageInfo.getZoomImage(aImageSrc, node, flags);
    if (null != betterResult) {
      aImageSrc = betterResult;
    }
  }
  return aImageSrc;
};

  
// ebay sites include ebay.com, .es, .fr, .com.au, com.uk, etc.
var ebayDomainPattern = "ebay\\.[a-z\\.]{2,6}";

/**
 * OthersIndirect: Determine if the target node is linked (like the Others)
 * rule) and if it is, load and scan the linked page for a full-size image.
 */
ThumbnailZoomPlus.Pages.OthersIndirect = {
  key: "othersindirect",
  name: "", // Set in ENTITY_page_othersindirect.
  host: /.*/,
  
  // invocationNumber increments at the start of each invocation of
  // getZoomImage.  We use this to detect and abort a request if a
  // newer request has been made (so we don't see a prior request's
  // pop-up appear after hovering a different thumb).
  // Also accessed globally from pagesIndirect.js.
  invocationNumber : 0,

  // Set imageRegExp to match pages which are likely to produce a thumbnail,
  // due to a flash video player or something else we can recognize.  We want
  // to exclude pages which won't produce anything since running getZoomImage
  // can be slow (it has to load the target page).
  //
  // Expression Tips:
  // Patterns in () must match starting from first slash (or earlier)
  // up to end of entire URL, so typically start with // and end with .* .
  
  imageRegExp: new RegExp(  "imgur\\.com/(?:a|gallery)/"
                          + "|imgbox\.com/g/[^/]+$"
                          + "|\\." + ebayDomainPattern + "/(itm|viewitem|ebaymotors|ctg|ws/eBayISAPI\\.dll\\?viewItem)"
                          + "|(?:myworld|deals)\\." + ebayDomainPattern + "/"
                          + "|deals\\." + ebayDomainPattern
                          + "|flickr\\.com/photos/.*/[0-9]{7,20}/"
                          + "|flickr\\.com/photos/[^@]*/sets/"
                          + "|liveleak\\.com/view"
                          + "|vimeo\\.com/(m/)?[0-9]{4,20}"
                          + "|blip\\.tv/.*[/-][0-9]{4,20}$"
                          + "|moth..l.s+\.com/.*[0-9A-F]{6,12}$"
                          + "|/video[0-9]{6,20}(/.*)?$"
                          + "|image.aven\\.net/(img\\.php|gallery\/)"
                          + "|image.enue\\.com/(img|galshow)\\.php"
                          + "|x.am.ter\\.com/movies/[0-9]{4,20}"
                          + "|image.am\\.com/image/"
                          + "|500px\\.com/photo/[0-9]+"
                          + "|dailymotion\\.com/video/"
                          + "|lockerz\\.com/./[0-9]{4,20}"
                          + "|(wired\\.com/.*[^#])$"
                          + "|gfycat\.com/[A-Z][^/]*$"
                          + "|(instagram\\.com|instagr\\.am)/p/"
                          // We include yfrog, but note that for pictures we 
                          // could get a URL directly in the Others rule (faster)
                          // by appending :tw1 or :twthumb.  But it doesn't work
                          // for videos and we can't tell in advance that it's a video.
                          + "|yfrog\\.com/([a-z]/)?[^/#]+(#.+)?$"
                          // When testing to find new sites we can support,
                          // uncomment the line below to allow the rule on all
                          // links (this will slow TZP down so don't enable it
                          // in production releases).
                          // + "|.*"
                          + "|bugguide.net"
                          + "|deviantart\.com/art/"
                          + "|www.furaffinity.net/view/"
                          + "|gyazo.com/[a-z0-9]{32}"
                          + "|p.rnhub\.com/photo/"
                        , "i"),
  
  // For "OthersIndirect"
  getImageNode : function(node, nodeName, nodeClass, imageSource) {
    if (nodeName != "img" && /wired\.com\/./.test(imageSource)) {
      // For Wired, use OthersIndirect only on linked thumbnails, not
      // textual links.
      return null;
    }
    if (/navigate-target/.test(nodeClass)) {
      // don't pop-up from main image in flickr.com lightbox view.
      return null;
    }
    
    node = ThumbnailZoomPlus.Pages.Others.getImageNode(node, nodeName, nodeClass, imageSource);
    return node;
  },
  
  // For "OthersIndirect"
  getZoomImage : function(aImageSrc, node, flags, pageSpecificData, pageCompletionFunc) {
    this.invocationNumber++;
    
    if (/gfycat\.com\/[A-Z][^\/]+$/.test(aImageSrc)) {
      // Convert e.g. http://www.gfycat.com/DapperQuarrelsomeImago to
      // http://gfycat.com/cajax/get/DapperQuarrelsomeImago.webm
      aImageSrc = aImageSrc.replace(/(gfycat\.com\/)/,
                                    "$1cajax/get/");
    }
    
    // For imgur.com, make sure it allows more than 11 images.  EG:
    // http://imgur.com/a/bDIdw#0 becomes
    // http://imgur.com/a/bDIdw/all
    // we'd like to also convert /gallery/ to /a/ since /gallery/ may not support /all,
    // and so wouldn't give access to images beyond ~11.  But some gallery links
    // don't exist as /a/ (possibly single-pic ones) so this isn't reliable.  issue #171.
    aImageSrc = aImageSrc.replace(/imgur\.com\/a\/([^#?/]+).*/, "imgur.com/a/$1/all");
    
    // Note: .bind() doesn't seem to be available in Firefox 3.6.
    aImageSrc = ThumbnailZoomPlus.PagesIndirect.
                getImageFromLinkedPage(node.ownerDocument, aImageSrc, flags,
                                       this.invocationNumber, pageCompletionFunc,
                                       this._getImageFromHtml.bind(this));
    
    return aImageSrc;
  },

  // For "OthersIndirect"
  _getImgFromHtmlText : function(aHTMLString, flags) {
    let logger = ThumbnailZoomPlus.Pages._logger;
    logger.trace("_getImgFromHtmlText");

    var re;

    // liveleak.com and other flash player sites:
    // Search for the jwplayer(...).setup(...) javascript call.  Note that
    // the '.' pattern doesn't match newlines so we use [\\\S] instead.
    re = /(?:jwplayer|flashvars)[\s\S]*?\s'?image'?[:=] *[\'\"]?([^\"\'&]+)["'&]/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    var match = re.exec(aHTMLString);
    if (match) {
      flags.setVideoBorderColor(match[1], "liveleak.com, etc. due to jwplayer");
      return match[1];
    }
    
    re = /flv_player.*?<img src=\"([^\"]+)"/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
      flags.setVideoBorderColor(match[1], "flv_player");
      return match[1];
    }
    
    re = /flash-player-embed.*?url_bigthumb=([^&]*)/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
      flags.setVideoBorderColor(match[1], "flash-player-embed");
      return match[1];
    }
    
    re = /<img src=\"([^\"]*image.enue.com\/loc[^"]*)/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
      return match[1];
    }
    
    // vimeo.com, etc. (pages indicating an image for Google+):
    // <meta itemprop="image" content="http://b.vimeocdn.com/ts/313/368/313368979_640.jpg">
    // Also works on weather.com
    // (I tried matching this in getImgFromSelectors but its contentattribute
    // always came back null).
    re = /<meta +itemprop="image" +content=\"([^\"]+)"/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
      if (/vimeo\.com/.exec(match[1])) {
        flags.setVideoBorderColor(match[1], "meta itemprop vimeo");
      }
    }
    
    // imgur.com /a/ albums, supporting > 11 images.
    // match e.g. <img alt="" src="//i.imgur.com/fXq9wP4s.jpg" gives
    // "http://i.imgur.com/fXq9wP4.jpg" (note removal of "s").
    re = /<img[^>]* data-src="(\/\/i\.imgur\.com\/[^"\.>]+?)s?\.(?:png|jpg|gif)/g;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
      return _allMatchesOf(re, match, aHTMLString, "https://$1.png");
    }
    
    // imgur.com /gallery/ albums.
    // <div class="image textbox"> <a href="//i.imgur.com/3MZSQUp.jpg" class="zoom"> <img src="//i.imgur.com/3MZSQUp.jpg" alt="" />
    // <a> is optional, and is present for high-rez images.
    re = /<div class="image [^>]*>\s*(?:<a[^>]*>\s*)?<img[^>]* src="(\/\/i\.imgur\.com\/[^"\.>]+?)\.(?:png|jpg|gif)/g;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
      return _allMatchesOf(re, match, aHTMLString, "https://$1.png");
    }
    
    // for imgbox.com galleries, eg look for e.g.
    // <img alt="92xy6bpu" src="http://8.s.imgbox.com/92XY6bPu.jpg" />
    re = /<img[^>]* src=".*\.s\.(imgbox\.com\/[^"\>]+)/g;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
      return _allMatchesOf(re, match, aHTMLString, "http://i.$1");
    }

    // imgur.com albums fallback (in case rule above doesn't work),
    // flickr.com sets, dailymotion.com, yfrog, wired.com, etc.
    // We disallow ending "?fb" in URL since on imgur.com ?fb seems to be a cropped
    // redundant thumbnail.
    re = /<meta +(?:property|name)=["']og:image[0-9]*["'] +content=[\"'](?!.*\\?fb)([^\"']+?)["']/g;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (! match) {
      // 500px
      var re2 = /<meta +content=[\"']([^\"']+)["'] +property=["']og:image["']/g;
      logger.debug("_getImgFromHtmlText: trying " + re2);
      match = re2.exec(aHTMLString);
      if (match) {
        // Use this unless it's the "ADULT CONTENT" image, in which case
        // we'll skip it in factor of a rule in _getImageFromHtml().
        if (/500px\.com\/graphics\/nude/.test(match[1])) {
          return null;
        }
        re = re2;
      }
    }
    
    if (match) {
      // Return this unless it's a yfrog video or ebay thumb,
      // for which we can get a larger image via getImgFromSelectors().
      // gyazo.com images skipped because og:image links to thumbnails, twitter:image regex below will handle it
      if (! /yfrog\.com\/.*\.mp4|phncdn\.com|ebaystatic\.com\/.|gyazo\.com/.test(match[1])) {
        return _allMatchesOf(re, match, aHTMLString, "$1");
      }
    }
    
    // gyazo.com, etc.
    // <meta content="http://i.gyazo.com/5a72871c5d808492e41c732a71dca8e8.png" name="twitter:image" />
    re = /<meta +content=\"([^\"]+)"\s+name="twitter:image"/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
        return match[1];
    }
    
    // p.rnhub.com photos
    re = /<meta +name="twitter:image:src"\s+content=\"([^\"]+)"/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
        return match[1];
    }
    
    // blip.tv, imgur.com/a/... (imgur may need .jpg added):
    //	<meta name="twitter:image"
    //     value="http://3.i.blip.tv/g?src=Rat2008-Micros02464-972.jpg&w=120&h=120&fmt=png&bc=FFFFFF&ac=0"/>
    re = /<meta +name="twitter:image"\s+value=\"([^\"]+)"/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
      // Increase resolution of blip.tv thumb.
      let result = match[1];
      result = result.replace(/w=[0-9]+&/, "w=640&").replace(/h=[0-9]+&/, "h=480&");

      if (/imgur\.com\/(?!gallery).*$/.test(result) && ! EXTS_RE.test(result)) {
        result = result + ".jpg";
      }
      return result;
    }

    // <link rel="image_src" href="http://...5192.jpg"
    // but don't match for flickr.com since other rule gives higher res.
    re = /<link +rel=\"image_src\" +href="([^"]+)"/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match && ! /flickr\.com/.test(match[1])) {
      return match[1];
    }

    // gfycat is actually parsing the return from their json api:
    // see http://gfycat.com/api
    // eg ... "webmUrl":"http:\/\/giant.gfycat.com\/HoarseWhichArkshell.webm", ...
    re = /"webmUrl" *: *"([^"]+?)"/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
      return match[1].replace(/\\/g, "");
    }
    
    // furaffinity.net
    // eg 'var full_url  = "//d.facdn.net/art/minnowfish/1365804573.minnowfish_redwblacksable.png";'
    re = /var full_url *= *"([^"]+)"/;
    logger.debug("_getImgFromHtmlText: trying " + re);
    match = re.exec(aHTMLString);
    if (match) {
      return match[1];
    }

    logger.debug("_getImgFromHtmlText: didn't match");
    return null;  
  },

  /**
   * tries to get an image URL from the aHTMLString, either via
   * _getImgFromHtmltext (raw text parsing) or via getImgFromSelectors
   * (html-based CSS selectors to find the appropriate node).
   *
   * Returns a URL string, and array of them, or null.
   */
  _getImageFromHtml : function(doc, pageUrl, flags, aHTMLString)
  {    
    let logger = ThumbnailZoomPlus.Pages._logger;
    let result = this._getImgFromHtmlText(aHTMLString, flags);
    logger.debug("_getImageFromHtml: from _getImgFromHtmlText got " + result);

    // Parse the document.
    // If we already have result, we parse only to get its base for applyBaseURI,
    // which is overkill and could be optimized.
    var docInfo = ThumbnailZoomPlus.PagesIndirect.parseHtmlDoc(doc, pageUrl, aHTMLString);
    if (! result) {
      // Selectors is a list of CSS selector strings which identify the img or a
      // node of the image.  See http://www.w3.org/TR/CSS2/selector.html .
      // EG tag#id or tag.class
      let selectors = [
        'div#media-media a + a img',
        'div#media-media img',
        'img#thepic',
        'div#imageContainer a + a',
        'div#vi-container center img', // ebay.com item (old layout?)
        'img#icImg', // ebay.com item
        'img#MyWorldImageIcon', // ebay.com myworld (profile) pic
        'span.dd-image img', // ebay.com daily deal
        'div#img center img#image', // image.aven.net
        'div.wrap div#left table a img', // image.aven.net gallery
        'div#show-photo img#mainphoto', // 500px.com photo page
        'img.the_photo', // 500px.com photo page
        'div#the-image a img', // yfrog.com pic
        'div.the-image img#main_image', // yfrog.com video
        'img#gmi-ResViewSizer_fullimg', // deviantart photo (old?)
        'img#dev-content-normal', // deviantart photo
        'img#primary_photo_img', // flickr.com set
        'div#allsizes-photo img', // flickr.com in All Sizes
        'img.bgimage-image', // bugguide.net
        'div#main-photo-container img[alt="photo"]' // flickr.com home page 'explore thumbs' or a page.
      ];
      
      result = ThumbnailZoomPlus.PagesIndirect.getImgFromSelectors(docInfo.body, selectors);
    }

    if (! result) {
      return null;
    }
    
    if ("[object Array]" != Object.prototype.toString.call(result)) {
      // We have a single result (not a gallery).  Process it.  We assume galleries don't need this.
      result = ThumbnailZoomPlus.FilterService.applyBaseURI(docInfo.doc, result);
        
      if (/dailymotion\.com\/|liveleak\.com\/|blip\.tv\//.test(aHTMLString)) {
        flags.setVideoBorderColor(result, "dailymotion or liveleak.com or blip.tv");
      }

      /*
       * Special rules to get bigger images from the result so far
       */

      // ebay:
      // http://i.ebayimg.com/t/.../s/ODAwWDQ5Ng==/$%28KGrHqRHJD!E+Ug!B9sIBQPCnqVgSw~~60_1.JPG becomes
      // http://i.ebayimg.com/t/.../s/ODAwWDQ5Ng==/$%28KGrHqRHJD!E+Ug!B9sIBQPCnqVgSw~~60_3.JPG becomes
      result = result.replace(/(\.ebayimg\.com\/.*~~(?:60)?)_[0-9]+(\.jpg)/i, "$1_57$2");
      // or _3 for somewhat lower rez?

      // flickr
      result = _getZoomImageViaPage(ThumbnailZoomPlus.Pages.Flickr.aPage, docInfo.body, result);
        
      // Thumbnail (to potentially get larger thumb from the URL we have so far)
      result = _getZoomImageViaPage(ThumbnailZoomPlus.Pages.Thumbnail.aPage, docInfo.body, result);
    }

    return result;
  }

};

  
/**
 * Thumbnail: returns an image derived from the thumbnail's URL as the image source.
 */
ThumbnailZoomPlus.Pages.Thumbnail = {
  key: "thumbnail",
  name: null, // don't show in menu
  host: /.*/,
  hostDisallow: /.*redditp\.com/,
  imageRegExp: /.*/,
  
  // READ THIS BEFORE EDITING:
  // We basically match any image, but exclude some which are annoying to
  // show.  Expression Tips:
  // Patterns in () must match starting from first slash (or earlier), 
  // so typically start with // .  Remember to use double backslash to quote.  
  imageDisallowRegExp : new RegExp("^[^/]*("
                          +  "(//.*\\.google\\.(com?(\\.[a-z]+)?|[a-z]+)/(.*/)?(images|logos)/)" // google logos
                          + "|(//[a-z0-9]+\\.google\\.com?[.a-z]*/.*[/?&]lyrs=)" // google maps tiles
                          + "|(//(maps|khms.*)\\.google\\.com?[.a-z]*/)" // google maps user photo popups, etc.
                          + "|(//.*\\.gstatic\\.com?[.a-z]*/)" // google maps button images, google drive file type icons
                          + "|//.*opencyclemap\\.org/" // openStreetMap.org tiles
                          + "|(//[^/]*\.google\\.com?[.a-z]*/forum/.*\\.cache\\.(png|gif))" // groups.google.com, productforums.google.com
                          + "|(//.*maptile.lbs.ovi.com/)" // yahoo maps tiles
                          + "|(//sh\\.deviantart\\.net/shadow/)" // deviantart frame around thumbs
                          + "|(//st\\.deviantart\\.net/)" // deviantart logo
                          + "|((.*\\.)(ssl-)?images\-amazon\\.com/images/.*/(buttons|gui|ontv)/)" // amazon buttons; see also Amazon rule.
                          + "|(//[^/]*tiles\\.virtualearth\\.net/)" // bing.com/maps tiles
                          + "|(//[^/]*.maps.live.com/i/)" // bing.com/maps directions pin
                          + "|^https?://my\\.xmarks\\.com/" // my.xmarks.com
                          + "|.*\\$live\\.controls\\.images/" // microsoft outlook.com
                          + "|https?://.\\.gfx\\.ms\\/is\\/" // outlook.com icons
                          + "|.*\\.hotmail.com/cal/" // microsoft hotmail/live calendar
                          + "|.*-(word|excel|powerpoint|onenote).*\\.msecnd\\.net/" // microsoft office on skydrive
                          + "|.*\\.wlxrs\\.com/" // microsoft office on skydrive
                          + "|editImageHandler\\.ashx" // microsoft powerpoint slide thumbs
                          + "|//media\\.cdn-redfin\\.com/.*/osprite\\." // redfin detail pics where we don't work
                          + "|//t[0-9]+\\.parcelstream\\.com/" // maps on redfin, etc.
                          + "|//.*\\.googleapis\.com/vt/" // 45-degree google maps on redfin
                          + "|//img[0-9]+\\.wsimg\\.com/dcc/" // GoDaddy: My Account (Domain Manager) https://mya.godaddy.com/default.aspx
                          + "|//img[0-9]+\\.wsimg\\.com/DNSManager/" // goDaddy: DNS Manager https://dns.godaddy.com/default.aspx 
                          + "|//.*twimg.*/img/front_page/" // Twitter background image on login page.
                          + "|//.*/images/tiny_mce" // toolbar of html editor in jive cms and elsewhere
                          + "|.*\\.4sqi\\.net/.*sprite" // foursquare map sprites
                          + "|//static\.wallhaven\.cc"
                          + ").*", "i"),

  // For "Thumbnail"
  getImageNode : function(node, nodeName, nodeClass, imageSource) {
    // Some sites need to find the image's node from an ancestor node.
    let parentClass = node.parentNode.className;
    // ThumbnailZoomPlus.debugToConsole("Thumbnail: nodeName=" + nodeName + " nodeClass=" + nodeClass + " parentClass=" + parentClass);
    let generationsUp = -1;
    let wantLastChild = 1;
    let selector = "img"; // css selector for child node relative to generationsUp.
    if (nodeName == "div" && /^(date|notes)$/.test(nodeClass)) {
      generationsUp = 3;
    }
    if (nodeName == "svg") {
      // Search for "image" tag nested inside the "svg" tag (eg on google docs document).
      generationsUp = 0;
      selector = "image";
    }
    if (/gii_folder_link/.test(nodeClass) ||
        (nodeName == "div" && /^inner$/.test(nodeClass)) ||
         nodeName == "span" && /preview-overlay-container/.test(nodeClass) || //  google play apps
          /cd_activator/.test(parentClass) || // pandora.com small thumb in upper-right corner
          (nodeName == "a" && /stage/.test(parentClass) && "go" == nodeClass) // tumblr search results
          ) {
      generationsUp = 2;
    }
    if (nodeName == "a" && "hover" == nodeClass && /post_glass/.test(parentClass)) { // tumblr archive
      generationsUp = 2;
      selector = "div.has_imageurl";
    }
    if (nodeName == "span" 
          && ("post_date" == nodeClass || "post_notes" == nodeClass || "tags" == nodeClass) 
          && /hover_inner|hover_tags/.test(parentClass)) { // tumblr archive
      generationsUp = 4;
      selector = "div.has_imageurl";
    }
    
    if ((/psprite/.test(nodeClass) && nodeName == "div") || // for dailymotion.com
        (nodeName == "div" && /^overlay$/.test(nodeClass)) ||
        (nodeName == "div" && /enlarge-overlay/.test(nodeClass)) || // for allmusic.com
        (nodeName == "img" && "photo" == nodeClass && /media\.tumblr\.com/.test(imageSource)) || // tumblr archive
        (nodeName == "div" && "thumbnailOverlay" == nodeClass) // photobucket
        ) {
      // minus.com single-user gallery or
      // tumblr archive with text overlays like http://funnywildlife.tumblr.com/archive
      // img nodes are in <img> child of the (great(grand))parent node of the
      // hovered-over <a> node.  Find that node.  We don't specificaly test for
      // the tumblr domain since we want to work even when a different domain
      // is used, eg http://www.valentinovamp.com/archive
      // TODO: a generalization of this logic might be useful in general, e.g.
      // for yahoo.co.jp
      generationsUp = 1;
    }
    if ((nodeName == "a" && "biz-shim" == nodeClass) // yelp photos
        ) {
      generationsUp = 1;
      wantLastChild = 0;
    }
    
    // 500px.com/flow has the image in the background-image of a <div>
    // parent of the <a> link.
    if (nodeName == "a" && "link" == nodeClass) {
      generationsUp = 2;
      selector = "div.photo";
    }
    if (generationsUp >= 0) {
      ThumbnailZoomPlus.Pages._logger.debug("thumbnail getImageNode: detected site which needs ancestor node; going up "
          + generationsUp + " levels and then finding " + selector);
      let ancestor = node;
      while (generationsUp > 0 && ancestor) {
        ancestor = ancestor.parentNode;
        generationsUp--;
      }
      if (ancestor) {
        // Find child nodes matching selector
        var ancestorClass = ancestor.className;
        let imgNodes = ancestor.querySelectorAll(selector);
        if (imgNodes.length > 0) {
          // Confirm that it's one of the expected sites.
          if (/gii_folder_link/.test(nodeClass) ||
              /preview_link/.test(ancestorClass) ||  // dailymotion
              /photo|post/.test(ancestorClass) ||
              /cd_icon/.test(ancestorClass) || // pandora.com
              /image-container/.test(ancestorClass) || // allmusic.com
              /photo one/.test(ancestorClass) || // 500px.com
              /cover/.test(ancestorClass) || // google play apps
              ("center" == ancestor.localName.toLowerCase() && /media\.tumblr\.com/.test(imageSource)) ||
              (/thumbnailLink/.test(ancestorClass) ||
              (selector == "image"))
              ) {
            // take the first or last child.
            node = imgNodes[wantLastChild * (imgNodes.length-1)];
          } else {
            ThumbnailZoomPlus.Pages._logger.debug("thumbnail getImageNode: unconfirmed, class " + ancestorClass);
          }
        } else {
            ThumbnailZoomPlus.Pages._logger.debug("thumbnail getImageNode: no matching nodes under " + 
                                                  ancestor + " class " + ancestorClass);
        }
      }
      ThumbnailZoomPlus.Pages._logger.debug("thumbnail getImageNode: initially got " + node);
    }
    
    if (nodeName == "img" && /\/blank\.gif$/.test(imageSource)) {
      // meetup.com sometimes has image in background-image of <a> in
      // <a><img src=".../blank.gif"></a>.
      node = node.parentNode;
    }
  
    if (/albumart-treatment-/.test(imageSource)) {
      // pandora.com big thumb in player.  Image is on peer <img class="art">.
      node = node.parentNode.querySelector("img.art");
    }
    
    if (/olTileImage|olButton/.test(nodeClass) ||
        /openlayers/i.test(node.id)) {
      // Don't show pop-ups on maps from the http://openlayers.org API
      // (including http://earthquake.usgs.gov/earthquakes/map/ ).
      return null;
    }
    
    return node;
  },
  
  /**
   * getInitialImageSrc() returns aImageSrc an absolute URL of
   * aImageSrc itself, or if we can get a better starting URL from
   * the node's image, background-image, etc., it uses that.
   * This is used by the Thumbnail and ThumbnailItself rules.
   *
   * The function of this is somewhat similar to getImageNode(), but
   * it directly returns the URL rather than a node since it gets
   * the URL in some site-specific ways.
   *
   * This is used by rules Thumbnail and ThumbnailItself.
   */
  // For "Thumbnail"
  getInitialImageSrc : function(aImageSrc, node) {
    let verbose = false;
    let nodeClass = node.getAttribute("class");

    if (! node.hasAttribute("src") && node.hasAttribute("href") &&
        node.style.backgroundImage.indexOf("url") == -1 && node.localName.toLowerCase() != "image") {
      // We don't want to use node if it's just an href since we need
      // it to be an actual image.  (The Others rule already handles hrefs.)
      ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getInitialImageSrc: ignoring since it's a link, not a thumb");
      return null;
    }
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getInitialImageSrc: so far have " + aImageSrc);

    // For certain sites, if node has a background style, use image from that.
    // And actually, aImageSrc may be already coming from the
    // background but needs to be excluded.
    // But in general we don't since it leads to too many popups from static
    // background styling (non-image) graphics.
    let backImage = node.style.backgroundImage;
    let urlRegExp = /url\("(.*)"\)$/i;
    if (backImage && "" != backImage && urlRegExp.test(backImage)) {
      if (node.children.length > 0 && ! /thumb|mem-photo-small|photo/.test(nodeClass)) {
        // Ignore e.g. in Google Offers, where a big map image is the background
        // around the guts of the page.
        // But we explicitly allow using background image if nodeClass
        // contains "thumb", as on ??? or "mem-photo-small" as on meetup.com or "photo" on 500px.com/flow
        ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getInitialImageSrc: ignoring background image since has " +
            node.children.length + " children > 0");
        return null;
      }
      aImageSrc = backImage.replace(urlRegExp, "$1");
    }

    let better_attrs = [
       // For diasp.org & similar, get from <img data-full-photo="http://...">:
       "data-full-photo",
       // For dailymotion.com, get from <img data-spr="http://...">:
       "data-spr",
       // for tapiture.com:
       "data-img-full"];       
    for (var i in better_attrs) {
      let better = node.getAttribute(better_attrs[i]);
      if (better) {
        aImageSrc = better;
        break;
      }
    }
        
    /*
     * Make it an absolute URL.
     */
    aImageSrc = ThumbnailZoomPlus.FilterService.applyBaseURI(node.ownerDocument, aImageSrc);
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getInitialImageSrc p06: so far have " + aImageSrc);

    // Disable for certain kinds of Facebook thumbs.
    ThumbnailZoomPlus.Pages._logger.debug("thumbnail getInitialImageSrc: node=" +
                                          node + "; class=" +
                                          nodeClass);
    if ("spotlight" == nodeClass && /\.(fbcdn|akamaihd)\.net/.test(aImageSrc) // facebook 'lightbox'
        ) {
        ThumbnailZoomPlus.Pages._logger.debug("getInitialImageSrc: ignoring since Facebook spotlight");
      return null;
    }
    if (nodeClass && nodeClass.indexOf("UFIActorImage") >= 0) {
      // Don't show popup for small Facebook thumb of the person who's
      // entering a comment since the comment field loses focus and the 
      // thumbnails disappears, which is confusing.
        ThumbnailZoomPlus.Pages._logger.debug("getInitialImageSrc: ignoring since Facebook UFIActorImage");
      return null;
    }
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getInitialImageSrc p10: so far have " + aImageSrc);

    return aImageSrc;
  },
  
  // For "Thumbnail"
  getZoomImage : function(aImageSrc, node, flags) {
    let verbose = false;
    let originalImageSrc = aImageSrc;
    var before;
    var match;
    
    let nodeName = node.localName.toLowerCase();
    let nodeClass = node.getAttribute("class");
    ThumbnailZoomPlus.Pages._logger.debug("getZoomImage Thumbnail for " + nodeName 
                                          + " class='" + nodeClass + "'" +
                                          " baseURI=" + node.baseURI);

    aImageSrc = ThumbnailZoomPlus.Pages.Thumbnail.getInitialImageSrc(aImageSrc, node);
    if (null == aImageSrc) {
      return null;
    }

    // imgur.com
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(/(i\.imgur\.com\/[0-9a-zA-Z]{7,7})[bsm](\.jpg)$/,
                                  "$1$2");
    if (before != aImageSrc && ThumbnailZoomPlus.Pages.Imgur.isLinkedToImgurGallery(aImageSrc, node)) {
      // Don't show a pop-up based on the thumb's image if we're inside an imgur
      // galley link.  Instead let Others (Indirect) handle it, since it may be
      // a multi-image gallery which the imgur rule can't handle.
      // On imgur.com itself all thumbs seem to be in such links, so the imgur
      // rule may end up activating only on imgur thumbs on other sites.
      aImageSrc = before;
    }

    // For tiny tumblr profile thumbs change 
    // http://30.media.tumblr.com/avatar_a1aefbaa780f_16.png to
    // http://30.media.tumblr.com/avatar_a1aefbaa780f_128.png ; also as
    // https://gs1.wac.edgecastcdn.net/8019B6/data.tumblr.com/avatar_c9703e0bc252_64.png
    // TODO: Similar changes would help for images in archives, changing 128 to 400, 500, or 1280.
    // But we aren't guaranteed that those sizes exist so we don't handle that case.
    let tumblrRegExp = /(\.tumblr\.com\/avatar_[a-f0-9]+)_[0-9][0-9]\./;
    aImageSrc = aImageSrc.replace(tumblrRegExp, "$1_128.");
    
    // other sites embedding tumblr images, eg tumview.com
    aImageSrc = aImageSrc.replace(/(\.tumblr\.com\/.*)_(?:75sq|[1234]\d\d)\.(png|jpg)/, "$1_1280.$2");
    aImageSrc = aImageSrc.replace(/(\.tumblr\.com\/.*)_75sq\.gif/, "$1_400.gif");
    aImageSrc = aImageSrc.replace(/(\.tumblr\.com\/.*)_[1234]\d\d\.gif/, "$1_400.gif");

    if (! /-tour-/.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(/(\/galleries\/.*\/x-.*-)ltn\.jpg/,
                                    "$1sml.jpg");
    }
        
    // For Wordpress and (formerly) Bing Images, etc., get URL from
    // imgurl=... part.
    // eg, change:
    // http://s2.wp.com/imgpress?w=222&url=http%3A%2F%2Fthreehundredsixtysixdaysdotcom.files.wordpress.com%2F2012%2F02%2Fvalentines_me.jpg to
    // http://threehundredsixtysixdaysdotcom.files.wordpress.com/2012/02/valentines_me.jpg
    let imgurlEx = /[\?&](img_?)?url=([^&]+)/;
    match = imgurlEx.exec(aImageSrc);
    if (match) {
      aImageSrc = match[2];
      aImageSrc = decodeURIComponent(aImageSrc);
      if (! /^https?:\/\/./i.test(aImageSrc)) {
        ThumbnailZoomPlus.Pages._logger.debug("getZoomImage: adding http:// prefix after finding url=" +
                                              aImageSrc);
        aImageSrc = "http://" + aImageSrc;
      }
    }
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p20: so far have " + aImageSrc);
    
    // For wordpress, change:
    // http://trulybogus.files.wordpress.com/2012/02/p2126148.jpg?w=150&h=104 to
    // http://trulybogus.files.wordpress.com/2012/02/p2126148.jpg
    // Similarly for http://wsj2day.files.wordpress.com/2012/03/wsj4060.jpg?w=72&crop=1&h=72
    let wordpressEx = new RegExp("https?://[^/]+\\.files\\.wordpress\\.com/");
    if (wordpressEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(/[?&]w=[0-9]+/, "");
      aImageSrc = aImageSrc.replace(/[?&]h=[0-9]+/, "");
      aImageSrc = aImageSrc.replace(/[?&]crop=[0-9]+/, "");
    }
    
    // gravatar (eg wordpress profile images):
    // https://2.gravatar.com/avatar/bdd58a13c7539fe81d07607a3aac6cd5?s=100&d=https%3A%2F%2Fsecure.gravatar.com... becomes
    // https://2.gravatar.com/avatar/bdd58a13c7539fe81d07607a3aac6cd5?s=300 (or any size).
    aImageSrc = aImageSrc.replace(/(gravatar\.com\/avatar\/.*?[\?&])s=.*/,
                                  "$1s=300");
                                  
    // egotastic.com, etc. (various wordpress sites); 
    // http://cdn02.cdn.egotastic.com/wp-content/uploads/2012/04/30/miley-cyrus-striped-top-pilates-07-94x94.jpg becomes
    // http://cdn02.cdn.egotastic.com/wp-content/uploads/2012/04/30/miley-cyrus-striped-top-pilates-07.jpg
    before = aImageSrc;
    let wpContentEx = new RegExp("(/wp-content/uploads/.*)-[0-9]+x[0-9]+(" + 
                                 EXTS + ")");
    aImageSrc = aImageSrc.replace(wpContentEx, "$1$2");
    if (aImageSrc != before) {
      // this rule doesn't always work so don't show error indicator.
      flags.noErrorIndicator = true;
    }
    
    // familyhandyman.com
    // http://hostedmedia.reimanpub.com/TFH/Step-By-Step/display/FH07APR_SPRFIX_04.JPG becomes
    // http://hostedmedia.reimanpub.com/TFH/Step-By-Step/FH07APR_SPRFIX_04.JPG
    // http://hostedmedia.reimanpub.com/TFH/Projects/Thumbnail108x108/FH00MAR_YARDRA_01.JPG becomes
    // http://hostedmedia.reimanpub.com/TFH/Projects/FH00MAR_YARDRA_01.JPG
    aImageSrc = aImageSrc.replace(/(\/\/hostedmedia\.reimanpub\.com\/.*\/)(?:display|Thumbnail\d+x\d+)\//, "$1");
    
    
    // for nextdoor.com change
    // https://d3dqvga78raec5.cloudfront.net/post_photos/25/6a/256a5c1b0e8b775adad497e1f6fd8063.JPG.115x115.JPG to
    // https://d3dqvga78raec5.cloudfront.net/post_photos/25/6a/256a5c1b0e8b775adad497e1f6fd8063.JPG.max900.JPG
    aImageSrc = aImageSrc.replace(/(\/d3dqvga78raec5\.cloudfront\.net\/.*\/[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+(?:\.JPG)?)\..*\.JPG/i,
                                  "$1");
                                  
    // For blogger aka Blogspot, change
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s500/DSC_0043.JPG to
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s1600/DSC_0043.JPG; change
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s320-p/Tiara+Riley.jpeg to
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s1600-p/Tiara+Riley.jpeg
    // NOTE: This rule exists in both Others and Thumbnails, and should be the same in both.
    let blogspotRegExp = new RegExp("(\\.(blogspot|blogger)\\.com/.*)/s[0-9]+(-[a-z])?/([^/?&]+\.[^./?&]*)$");
    aImageSrc = aImageSrc.replace(blogspotRegExp, "$1/s1600/$4");
    
    // iconosquare.com (formerly Statigr.am) and possibly other instagram.com-related sites:
    // http://scontent-b.cdninstagram.com/hphotos-xfa1/l/t51.2885-15/10665653_493240594153262_1854672376_s.jpg becomes
    // http://scontent-b.cdninstagram.com/hphotos-xfa1/l/t51.2885-15/10665653_493240594153262_1854672376_n.jpg
    // http://scontent-a.cdninstagram.com/hphotos-xap1/t51.2885-15/10518093_541390389340215_1536433172_s.jpg similarly.
    // also, for user's own photos:
    // http://scontent-a.cdninstagram.com/hphotos-xfa1/outbound-distilleryimage4/t0.0-17/OBPTH/8a5f1e0e873411e1af7612313813f8e8_5.jpg becomes
    // http://scontent-a.cdninstagram.com/hphotos-xfa1/outbound-distilleryimage4/t0.0-17/OBPTH/8a5f1e0e873411e1af7612313813f8e8_7.jpg
    aImageSrc = aImageSrc.replace(/(\/\/scontent-.\.cdninstagram.com\/.*)_s.jpg/, "$1_n.jpg");
    aImageSrc = aImageSrc.replace(/(\/\/scontent-.\.cdninstagram.com\/.*)_[0-6].jpg/, "$1_7.jpg");

    // For weibo.com profile pics, change
    // http://tp1.sinaimg.cn/1744655144/50/5602386657/0 to
    // http://tp1.sinaimg.cn/1744655144/180/5602386657/0
    aImageSrc = aImageSrc.replace(/(\.sinaimg\.cn\/[0-9]+)\/50\/(.*)/, "$1/180/$2");

    // For weibo.com photos, change
    // http://ww4.sinaimg.cn/thumbnail/4b80c1bdjw1drrv3te5ygj.jpg to
    // http://ww4.sinaimg.cn/large/4b80c1bdjw1drrv3te5ygj.jpg
    aImageSrc = aImageSrc.replace(/(\.sinaimg\.cn)\/thumbnail/, "$1/large");

    aImageSrc = aImageSrc.replace(/\/free_pictures\/thumbs\//, "/free_pictures/normal/");
    
    // For taobao.com, change
    // http://img01.taobaocdn.com/bao/uploaded/i2/T130KYXatnXXXL.Tk3_051312.jpg_310x310.jpg to
    // http://img01.taobaocdn.com/bao/uploaded/i2/T130KYXatnXXXL.Tk3_051312.jpg
    // sim for:
    // http://img02.taobaocdn.com/bao/uploaded/i2/T1zrSVXitjXXaE.Ufb_095429.jpg_b.jpg
    // sim for:
    // http://img01.taobaocdn.com/imgextra/i1/T1NJP_XclfXXccGpQZ_031229.jpg_40x40.jp
    aImageSrc = aImageSrc.replace(new RegExp("(/(?:bao|imgextra)/.*\\.jpg)_(?:[0-9]+x[0-9]+|[a-z]+)\\.jpg$"), "$1");
    
    // For leBonCoin.fr: image URLs don't contain the site domainname, so instead
    // we verify the site using baseURI.
    let leBonCoinSiteRegExp = new RegExp("\\.leboncoin\\.fr/", "i");
    if (leBonCoinSiteRegExp.test(node.baseURI)) {
      // change
      // http://193.164.197.30/thumbs/171/1716737621.jpg to
      // http://193.164.197.30/images/171/1716737621.jpg
      let leBonCoinRegExp = new RegExp("/thumbs/([0-9]+/[0-9]+" + 
                                       EXTS +
                                       ")");
      aImageSrc = aImageSrc.replace(leBonCoinRegExp, "/images/$1");
    }
    
    // photobucket (see also the photobucket rule).
    // http://rs915.pbsrc.com/albums/ac353/ThunderCracker_photos/Tempest%20Skies%20Photography/123.jpg~c200 becomes
    // http://i915.photobucket.com/albums/ac353/ThunderCracker_photos/Tempest%20Skies%20Photography/123.jpg
    aImageSrc = aImageSrc.replace(/:\/\/rs([0-9]+)\.pbsrc\.com\/(.*)~c200$/, "://i$1.photobucket.com/$2");

    // costco.com:
    // http://images.costco.com/image/media/150-759675-847__1.jpg becomes
    // http://images.costco.com/image/media/500-759675-847__1.jpg ; some have 700- too.
    aImageSrc = aImageSrc.replace(/(:\/\/images\.costco\.com\/image\/media)\/[0-9]{2,3}-([0-9]+-[0-9_]+.jpg)/, 
                                  "$1/500-$2");

    // target.com:
    // http://img3.targetimg3.com/wcsstore/TargetSAS//img/p/13/04/13040966_138x138.jpg becomes
    // http://img3.targetimg3.com/wcsstore/TargetSAS//img/p/13/04/13040966.jpg
    aImageSrc = aImageSrc.replace(/(\.targetimg[0-9]+\.com\/.*\/img\/.*[0-9])_[0-9]+X[0-9]+\./,
                                  "$1.");
                                  
    // walmart.com:
    // http://i.walmartimages.com/i/p/03/41/77/61/29/0341776129500_180X180.jpg becomes
    // http://i.walmartimages.com/i/p/03/41/77/61/29/0341776129500_500X500.jpg
    aImageSrc = aImageSrc.replace(/(\.walmartimages\.com\/.*)_[0-9]+X[0-9]+\./,
                                  "$1_500X500.");

    // overstock.com:
    // http://ak1.ostkcdn.com/images/products/6322591/Infinity-Collection-Blue-Area-Rug-710-x-103-d2d88537-8712-4ea8-b910-9e60c589236c_80.jpg?wid=58&hei=58&op_sharpen=1 or
    // http://ak1.ostkcdn.com/images/products/6322591/Infinity-Collection-Blue-Area-Rug-710-x-103-d2d88537-8712-4ea8-b910-9e60c589236c_600.jpg becomes
    // http://ak1.ostkcdn.com/images/products/6322591/Infinity-Collection-Blue-Area-Rug-710-x-103-d2d88537-8712-4ea8-b910-9e60c589236c.jpg
    aImageSrc = aImageSrc.replace(/(\/\/ak[0-9]+\.ostkcdn\.com\/images\/.*)_[0-9]+(\.jpe?g).*/, "$1$2");
    
    // overstock.com:
    // http://ak1.ostkcdn.com/images/products/3962805/Ultra-Non-slip-Rug-Pad-8-x-10-P11996894.jpg becomes
    // http://ak1.ostkcdn.com/images/products/3962805/Ultra-Non-slip-Rug-Pad-8-x-10-L11996894.jpg
    aImageSrc = aImageSrc.replace(/(\/\/ak[0-9]+\.ostkcdn\.com\/images\/.*[-\/])[TP]([0-9]+\.jpe?g.*)/, "$1L$2");

    // myway.com uses imgfarm.com
    // http://ak.imgfarm.com/images/ap/thumbnails//NSA-Phone_Records-Snowden_Girlfriend.sff_RPBW101_20130611214357.jpg or
    // http://ak.imgfarm.com/images/ap/gallery//NSA-Phone_Records-Snowden_Girlfriend.sff_RPBW101_20130611214357.jpg become
    // http://ak.imgfarm.com/images/ap//NSA-Phone_Records-Snowden_Girlfriend.sff_RPBW101_20130611214357.jpg
    aImageSrc = aImageSrc.replace(/(\.imgfarm\.com\/images\/.*\/)(?:gallery|thumbnails)\/+(.*\.jpg)/, 
                                  "$1$2");
    
    // http://toronto.kijiji.ca/ ; http://petites-annonces.kijiji.be/ ; http://oesterreich.kijiji.at ; http://intoko.kijiji.com.tr ; kijiji.com.tw
    // (ebay classified outside the US):
    // http://i.ebayimg.com/00/s/NzkwWDEwMDA=/$%28KGrHqZ,!rIFG,bz!vV7BRnYvVH,Qg~~48_14.JPG becomes
    // http://i.ebayimg.com/00/s/NzkwWDEwMDA=/$%28KGrHqZ,!rIFG,bz!vV7BRnYvVH,Qg~~48_10.JPG
    aImageSrc = aImageSrc.replace(/(i\.ebayimg\.com\/00\/.*)_(?:14|74)(\.jpg)/i, "$1_10$2");
    
    // http://www.kijiji.it
    // http://img1.annuncicdn.it/4f/90/4f90e626b2cca6c11a7614a93c16d2fb_thumbnail.jpg becomes
    // http://img1.annuncicdn.it/4f/90/4f90e626b2cca6c11a7614a93c16d2fb_orig.jpg
    aImageSrc = aImageSrc.replace(/(img[0-9]+\.annuncicdn\.it\/.*)_thumbnail(\.jpg)/i, "$1_orig$2");
    
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p30: so far have " + aImageSrc);

    // minus.com
    let minusRegexp = new RegExp("([.\\/]minus\\.com/.*)_(e|xs|xss|ss|m|ms)\\.jpg");
    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage: testing " + aImageSrc + " against " + minusRegexp +
            ": " + minusRegexp.test(aImageSrc));
    aImageSrc = aImageSrc.replace(minusRegexp, "$1.jpg");

    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p40: so far have " + aImageSrc);

    // For 500px.com change
    // http://pcdn.500px.net/6151440/23d1e866fda841f169e5f1bc5a329a7c217392cd/2.jpg becomes
    // http://pcdn.500px.net/6151440/23d1e866fda841f169e5f1bc5a329a7c217392cd/4.jpg
    // But some profile icons need to become /1 rather than /4, eg:
    // http://pacdn.500px.org/3033393/fddffd2e3c80bf36d69cc3a0ecaac88f436090ad/1.jpg?1 becomes
    // http://pacdn.500px.org/3033393/fddffd2e3c80bf36d69cc3a0ecaac88f436090ad/4.jpg?1
    // I've also seen gp1.wac.edgecastcdn.net/806614/photos/photos.500px.net/...
    aImageSrc = aImageSrc.replace(new RegExp("(\\.500px\\.(?:net|org)/.*)/[123](" +
                                  EXTS + ")"),
                                  "$1/4$2");
    //aImageSrc = aImageSrc.replace(new RegExp("(https?://[^/?]*\\.500px\\.(?:net|org)/.*)/[123](" +
    //                              EXTS + ").+"),
    //                              "$1/1$2");
    
    // anon ib
    aImageSrc = aImageSrc.replace(/\.com\/photos\/(?:medium|thumb)\/([0-9]+\.)/, ".com/photos/$1");
    
    // someimage.com
    // http://t1.someimage.com/TkscG18.jpg becomes
    // http://i1.someimage.com/TkscG18.jpg
    aImageSrc = aImageSrc.replace(/\/\/t([0-9]+\.someimage\.com\/)/,
                                  "//i$1");
                                  
    // For pbase.com (limited support; only works if the image exists as
    // 'large' size, and sometimes the actual image isn't on the same server
    // as the thumb and it doesn't work): change
    // http://www.pbase.com/fishit/image/65083612/medium.jpg to
    // http://www.pbase.com/fishit/image/65083612/large.jpg (or original or upload)
    aImageSrc = aImageSrc.replace(new RegExp("^(https?://[^/]*\\.pbase\\.com/.*)/(?:small|medium|large\)(.*" +
                                             EXTS + ")"), "$1/large$2");
    // Change http://i.pbase.com/t4/98/946498/4/142131724.HUWxuYPm.jpg to
    //        http://i.pbase.com/g4/98/946498/2/142131724.HUWxuYPm.jpg
    aImageSrc = aImageSrc.replace(new RegExp("^(https?://[^/]*\\.pbase\\.com)/[a-z]([0-9]/.*" +
                                             ")/[0-9]/([^/]*" +
                                             EXTS + ")"), "$1/g$2/2/$3");
                                             
    // for furaffinity.net:
    // http://t.facdn.net/10465114@150-1367079848.jpg#babbignes becomes
    // http://t.facdn.net/10465114@400-1367079848.jpg#babbignes (note 150 become 400)
    // http://t.facdn.net/10552258@200-1368057212.jpg becomes
    // http://t.facdn.net/10552258@400-1368057212.jpg
    aImageSrc = aImageSrc.replace(/(t\.facdn\.net\/[0-9]+)@[0123][0-9][0-9]-([0-9]+\.jpg)/,
                                  "$1@400-$2");
    
    // vimeo.com:
    // http://b.vimeocdn.com/ts/313/757/313757860_150.jpg becomes
    // http://b.vimeocdn.com/ts/313/757/313757860_640.jpg
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(/(\.vimeocdn\.com\/.*\/[0-9]+)_[0-9]{2,3}\.jpg/,
                                  "$1_640.jpg");
    // http://b.vimeocdn.com/ps/116/353/1163539_75.jpg (profile pic) becomes
    // http://b.vimeocdn.com/ps/116/353/1163539_300.jpg
    aImageSrc = aImageSrc.replace(/(\.vimeocdn\.com\/ps\/.*\/[0-9]+)_[0-9]{2,3}\.jpg/,
                                  "$1_300.jpg");
    if (before != aImageSrc) {
        flags.setVideoBorderColor(aImageSrc, "vimeocdn");
    }
    
    // foursquare.com:
    // https://irs3.4sqi.net/img/general/300x300/3824770_Mz86LtkdkQZPYZj6hPfgj1xLWG_pwWWKedGtlOrLCAQ.jpg becomes
    // https://irs3.4sqi.net/img/general/width960/3824770_Mz86LtkdkQZPYZj6hPfgj1xLWG_pwWWKedGtlOrLCAQ.jpg
    // https://irs1.4sqi.net/img/user/64x64/WVP02LFNO4A25W2E.jpg becomes
    // https://irs1.4sqi.net/img/user/width960/WVP02LFNO4A25W2E.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.4sqi\\.net/img.*)/[0-9]+x[0-9]+/"), "$1/width960/");

    // wired.com:
    // http://www.wired.com/images_blogs/autopia/2013/04/3448678338_e8785110ff_b-featured-200x100.jpg becomes
    // http://www.wired.com/images_blogs/autopia/2013/04/3448678338_e8785110ff_b-featured.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(www\\.wired\\.com/.*)-[0-9]+x[0-9]+(" +
                                  EXTS + ")"), "$1$2");
                                  
    // http://www.wired.com/wiredscience/wp-content/gallery/orca-sperm-whale/thumbs/thumbs_8-shawnheinrichs-20130418-120919-_b0a6186.jpg becomes
    // http://www.wired.com/wiredscience/wp-content/gallery/orca-sperm-whale/8-shawnheinrichs-20130418-120919-_b0a6186.jpg
    aImageSrc = aImageSrc.replace(/(www\.wired\.com\/.*)\/thumbs\/thumbs_(.*)/, "$1/$2");
                                  
    // dailymotion.com:
    // http://static2.dmcdn.net/static/video/920/961/47169029:jpeg_preview_sprite.jpg becomes
    // http://static2.dmcdn.net/static/video/920/961/47169029:jpeg_preview_large.jpg
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(/(\.dmcdn\.net\/static\/video\/.*:jpeg_preview)_(?:sprite|small|medium)/,
                                  "$1_large");
    if (before != aImageSrc) {
      flags.setVideoBorderColor(aImageSrc, "dailymotion in \"Thumbnail\"");
    }
    // http://static2.dmcdn.net/static/user/783/119/35911387:avatar_small.jpg?20100906012025 becomes
    // http://static2.dmcdn.net/static/user/783/119/35911387:avatar_large.jpg?20100906012025
    aImageSrc = aImageSrc.replace(/(\.dmcdn\.net\/static\/user\/.*:avatar)_(?:sprite|small|medium)/,
                                  "$1_large");

    // http://x1.fap.to/images/thumb/40/967/123456789.jpg becomes
    // http://fap.to/images/full/40/967/123456789.jpg
    aImageSrc = aImageSrc.replace(/\/\/x[0-9]*\.fap\.to\/images\/(mini|thumb)\//, "//fap.to/images/full/");
    
    // For some sites where /images/thumb/(digits) changes thumb to full.
    // This really belongs more in the Others rule, but it often wouldn't
    // work since it'd instead follow the <a> link around the image.
    let regEx = new RegExp("(/images)/(thumb|mini)/([0-9]+/[0-9]+/[0-9]+\.)");
    aImageSrc = aImageSrc.replace(regEx, "$1/full/$3");
    
    // For xh*ster.com, change 000/014/111/004_160.jpg to 000/014/111/004_1000.jpg
    regEx = new RegExp("(xh[a-z0-9]*ster.com.*/[0-9]+/[0-9]+/[0-9]+/[0-9]+)_[0-9]{1,3}(\.[a-z]+)");
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(regEx, "$1_1000$2");
    aImageSrc = aImageSrc.replace(/\/livesnap100\//, "/livesnap320/");
    if (before != aImageSrc) {
        flags.setVideoBorderColor(aImageSrc, "xh[a-z0-9]*ster.com.*");
    }
    
    aImageSrc = aImageSrc.replace(/(fantasti\..*\/+big\/.*)\/thumb[\/]/i, 
                                  "$1/");
    
    aImageSrc = aImageSrc.replace(/(\/cms\/ul\/)t-([0-9]{4,20})/, "$1$2");
    
    // etsy.com:
    // http://img0.etsystatic.com/001/0/5166156/il_75x75.352657160_pkc7.jpg becomes
    // http://img0.etsystatic.com/001/0/5166156/il_fullxfull.352657160_pkc7.jpg
    aImageSrc = aImageSrc.replace(/(\.etsy(?:static)?\.com\/.*\/il)_[a-z0-9]+x[a-z0-9]+\./i,
                                  "$1_fullxfull.");
    // http://www.etsy.com/blog/en/files/2012/10/etsyweddings_realweddings_McKenzieelizabeth_sml.jpg becomes
    // https://www.etsy.com/blog/en/files/2012/10/etsyweddings_realweddings_McKenzieelizabeth_LRG.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.etsy\\.com/.*[_-])sml(" + EXTS + ")"),
                                  "$1LRG$2");
    
    // https://www.etsy.com/blog/en/files/2012/10/glass_house_header2_small.jpg becomes
    // https://www.etsy.com/blog/en/files/2012/10/glass_house_header2.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.etsy\\.com/.*)[_-]small(" + EXTS + ")"),
                                  "$1$2");
    
    // https://www.etsy.com/blog/en/files/2012/11/fox-web-2751.jpg becomes
    // https://www.etsy.com/blog/en/files/2012/11/fox-web.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.etsy\\.com/.*-web)[_-][0-9]+(" + EXTS + ")"),
                                  "$1$2");
    
    // xmarks.com thumbs in category pages
    // http://thumbs.xmarks.com/discover/thumbnail/read?cid=DRFT&id=13544052&size=Small becomes
    // http://thumbs.xmarks.com/discover/thumbnail/read?cid=DRFT&id=13544052&size=Large
    aImageSrc = aImageSrc.replace(/(\/\/thumbs\.xmarks\.com\/.*\/thumbnail\/read\?.*&size)=Small/,
                                  "$1=Large");
                                  
    // rhapsody.com
    // http://static.rhap.com/img/170x170/7/9/1/8/1328197_170x170.jpg becomes
    // http://static.rhap.com/img/500x500/7/9/1/8/1328197_500x500.jpg
    aImageSrc = aImageSrc.replace(/(\.rhap\.com\/img)\/170x170\/(.*)_170x170\.jpg/,
                                  "$1/500x500/$2_500x500.jpg");
                          
    // allmusic.com by rovi
    // http://cps-static.rovicorp.com/3/JPG_250/MI0000/849/MI0000849999.jpg?partner=allrovi.com becomes
    // http://cps-static.rovicorp.com/3/JPG_500/MI0000/849/MI0000849999.jpg?partner=allrovi.com
    aImageSrc = aImageSrc.replace(/(\.rovicorp\.com\/[0-9]+\/)JPG_[0-9]+\//,
                                  "$1JPG_500/");
                                  
    // Sites using Piwigo image gallery, eg
    // http://www.worldwidefieldguide.com/galleries/Plantae/Ranunculales/Ranunculaceae/Pulsatilla/vulgaris/thumbnail/TN-DSCN0585.jpg becomes
    // http://www.worldwidefieldguide.com/galleries/Plantae/Ranunculales/Ranunculaceae/Pulsatilla/vulgaris/DSCN0585.jpg
    if ("thumbnail" == nodeClass && 
        "wrap2" == node.parentNode.parentNode.getAttribute("class")) {
      aImageSrc = aImageSrc.replace("/thumbnail/TN-", "/");
    }
    
    // td-galerie:
    // http://raxanathos.free.fr/modules/td-galerie/mini/20070407230812-4.jpg becomes
    // http://raxanathos.free.fr/modules/td-galerie/imgs/20070407230812-3.jpg
    aImageSrc = aImageSrc.replace("modules/td-galerie/mini/", "modules/td-galerie/imgs/");
    
    // photodom.com
    aImageSrc = aImageSrc.replace(/(photodom\.com\/photos\/.*\/)thumb_([0-9]+\.jpg)/,
                                  "$1$2");
    
    // homedepot.com
    // http://www.homedepot.com/catalog/productImages/145/30/30756488-d7f9-4ee6-917e-6ecedfe5d037_145.jpg becomes
    // http://www.homedepot.com/catalog/productImages/400/30/30756488-d7f9-4ee6-917e-6ecedfe5d037_400.jpg
    aImageSrc = aImageSrc.replace(/(www\.homedepot\.com\/.*productImages)\/[0-9]+\/(.*)_[0-9]+\.jpg/,
                                  "$1/400/$2_400.jpg");
    
    // for homedepot.com user-submitted pics in reviews:
    // http://homedepot.ugc.bazaarvoice.com/1999/228211/photoThumb.jpg becomes
    // http://homedepot.ugc.bazaarvoice.com/1999/228211/photo.jpg
    aImageSrc = aImageSrc.replace(/(homedepot\.ugc\.bazaarvoice\.com\/.*)\/photoThumb\.jpg/,
                                  "$1/photo.jpg");
                                  
    // For Google Play Android Apps, change
    // https://lh6.ggpht.com/JAPlPOSg988jbSWvtxUjFObCguHOJk1yB1haLgUmFES_r7ZhAZ-c7WQEhC3-Sz9qDT0=h230 to
    // https://lh6.ggpht.com/JAPlPOSg988jbSWvtxUjFObCguHOJk1yB1haLgUmFES_r7ZhAZ-c7WQEhC3-Sz9qDT0 and
    // and ...=w124 and ...==w78-h78
    let googlePlayRegExp = new RegExp("(\\.ggpht\\.com/.*)=[-wh0-9]+$");
    aImageSrc = aImageSrc.replace(googlePlayRegExp, "$1");
    
    // Google Play album: change
    // https://lh4.googleusercontent.com/Z0AD4MsVIa8qoMs69GmZqNRHq-dzapfbO_HrviLyBmmbgnwi1_YmhId29CojSoERSbdrqEMonBU=w128 to
    // https://lh4.googleusercontent.com/Z0AD4MsVIa8qoMs69GmZqNRHq-dzapfbO_HrviLyBmmbgnwi1_YmhId29CojSoERSbdrqEMonBU=w1000
    // and
    // https://encrypted.google.com/books?id=bgMiAFs66bwC&printsec=frontcover&img=2&zoom=2&source=ge-web-market to
    // https://encrypted.google.com/books?id=bgMiAFs66bwC&printsec=frontcover&img=2&zoom=0&source=ge-web-market
    // google play magazines: remove =w128-h175
    // and for drive.google.com:
    // change https://lh4.googleusercontent.com/M-wf8mn...EkY8tNA=s260 to
    // change https://lh4.googleusercontent.com/M-wf8mn...EkY8tNA
    aImageSrc = aImageSrc.replace(/(\.googleusercontent\.com\/.*)=[-swh0-9]+$/, "$1");
    aImageSrc = aImageSrc.replace(/(\.google\.com\/books?.*)&zoom=1&/, "$1&zoom=0&");

    // For diasp.org:
    // https://diasp.org/uploads/images/thumb_small_d4abd1cd065ed5746b01.jpg ->
    // https://diasp.org/uploads/images/d4abd1cd065ed5746b01.jpg
    // https://joindiaspora.com/uploads/images/thumb_small_Tf3hixImiB4d06d4482c174313aa001347.jpeg
    aImageSrc = aImageSrc.replace(new RegExp("/uploads/images/thumb_small_([a-z0-9]+" +
                                             EXTS + ")", "i"),
                                             "/uploads/images/$1");
    
    // meetme.com
    // http://content1.myyearbook.com/thumb_userimages/square/2012/09/24/00/thm_phpVqAGIe_0_68_400_468.jpg or
    // http://content1.myyearbook.com/thumb_userimages/2012/09/24/00/thm_phpVqAGIe.jpg becomes
    // http://content1.myyearbook.com/thumb_userimages/large/2012/09/24/00/thm_phpVqAGIe.jpg

    aImageSrc = aImageSrc.replace(/(myyearbook\.com\/thumb_userimages)\/(?:small\/|square\/|square-mini\/)?([0-9]{4,4}\/.*thm_[^_]+)(?:_[0-9]+_[0-9]+_[0-9]+_[0-9]+)?/,
                                  "$1/large/$2");

    //
    aImageSrc = aImageSrc.replace(/(\/files\/.*\/img\/.*\/)thumb_/, "$1");
    
    // meetup.com
    // http://photos3.meetupstatic.com/photos/event/4/a/1/c/global_131178972.jpeg becomes
    // http://photos3.meetupstatic.com/photos/event/4/a/1/c/highres_131178972.jpeg
    aImageSrc = aImageSrc.replace(/(\.meetupstatic\.com\/photos\/(?!member.*).*\/)(?:global|thumb|member|iab120x90)_(.*\.jpeg)/,
                                  "$1highres_$2");
    // Note that member pics sometimes have highres, but sometimes member size is the
    // highest available.  If we're already displaying 'member', popup 'highres'.
    // http://photos3.meetupstatic.com/photos/member/9/6/c/thumb_26162412.jpeg becomes
    // http://photos3.meetupstatic.com/photos/member/9/6/c/member_26162412.jpeg
    aImageSrc = aImageSrc.replace(/(\.meetupstatic\.com\/photos\/member\/.*\/)member_(.*\.jpeg)/,
                                  "$1highres_$2");
    if (/mem-photo-small/.test(node.parentNode.getAttribute("class"))) {
      // We don't popup large member photos from thumbs for which the site shows its
      // own popup.
      // http://photos3.meetupstatic.com/photos/member/9/6/c/thumb_26162412.jpeg becomes
      // http://photos3.meetupstatic.com/photos/member/9/6/c/member_26162412.jpeg
      aImageSrc = aImageSrc.replace(/(\.meetupstatic\.com\/photos\/member\/.*\/)(?:global|thumb|member|iab120x90)_(.*\.jpeg)/,
                                  "$1member_$2");
    }

    // rostr.d.....com:
    // https://rostr....com/ROSTRWS/rest/photos/rostrid/12345678/width/32/height/32/aspect/true/fill/true becomes
    // https://rostr....com/ROSTRWS/rest/photos/rostrid/12345678/width/32/height/150
    aImageSrc = aImageSrc.replace(/^(https?:\/\/rostr\..*\.com\/.*\/rostrid\/[0-9]+\/width)\/.*/,
                                  "$1/150");
                                  
    // modelmayhem.com:
    // http://photos.modelmayhem.com/avatars/6/1/6/5/8/3/4f8d45b8e42d2_t.jpg to
    // http://photos.modelmayhem.com/avatars/6/1/6/5/8/3/4f8d45b8e42d2_m.jpg
    aImageSrc = aImageSrc.replace(new RegExp("^(https?://photos\\.modelmayhem\\.com/avatars/.*)_t(" + 
                                             EXTS + ")", "i"),
                                             "$1_m$2");
    // http://photos.modelmayhem.com/photos/111202/20/4ed9ac558b0ef_m.jpg to
    // http://photos.modelmayhem.com/photos/111202/20/4ed9ac558b0ef.jpg
    aImageSrc = aImageSrc.replace(new RegExp("^(https?://photos\\.modelmayhem\\.com/photos/.*)_[a-z](" + 
                                             EXTS + ")", "i"),
                                             "$1$2");

    // viddy.com (see also in Others rule):
    // http://cdn.viddy.com/images/users/thumb/15dfd804-ab4f-4998-a1f4-fc56277fe0b3_150x150.jpg to
    // http://cdn.viddy.com/images/users/15dfd804-ab4f-4998-a1f4-fc56277fe0b3.jpg
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(new RegExp("^(https?://[^/]+\\.viddy\\.com/.*)/thumb/(.*)_[0-9]+x[0-9]+(" + 
                                             EXTS + ")", "i"),
                                             "$1/$2$3");
    if (before != aImageSrc) {
        flags.setVideoBorderColor(aImageSrc, "viddy.com");
    }


    // asos.com:
    // https://marketplace-images.asos.com/fa/6f7a9757-a839-4d07-93f2-7173ff34b677_small.jpg becomes
    // https://marketplace-images.asos.com/fa/6f7a9757-a839-4d07-93f2-7173ff34b677_huge.jpg
    aImageSrc = aImageSrc.replace(/(images\.asos\.com\/.*)_(?:small|medium)\.jpg/, "$1_huge.jpg");
    aImageSrc = aImageSrc.replace(/(images\.asos\.com\/.*)\/image1l\.jpg/, "$1/image1xxl.jpg");
    
    //
    aImageSrc = aImageSrc.replace(new RegExp("(bay\\.org/asm/.*)-[0-9]+x[0-9]+(" + EXTS + ")"),
                                  "$1$2");

    // imageporter.com
    aImageSrc = aImageSrc.replace(/(imageporter\.com\/.*)_t\.jpg/, "$1.jpg");

    aImageSrc = aImageSrc.replace(new RegExp("^(https?://images[0-9]*\\.pin[a-z]+\\.com/" +
                                             "images/pin[a-z]+/[0-9]+/[0-9]+/[0-9]+)/[0-9x]+/" +
                                             "([0-9a-z]+" + EXTS + ")", "i"),
                                  "$1/620/$2");
                                  
    // imagetwist:
    // http://img8.imagetwist.com/th/01282/999sz25wbi76.jpg becomes
    // http://img8.imagetwist.com/i/01282/999sz25wbi76.jpg
    aImageSrc = aImageSrc.replace(/(\.imagetwist\.com\/)th\//, "$1i/");

    // imgchili.com:
    // http://t2.imgchili.com/7428/9998984_ie_011.jpg becomes
    // http://i2.imgchili.com/7428/9998984_ie_011.jpg
    aImageSrc = aImageSrc.replace(/:\/\/t([0-9]+\.imgchili\.(?:com|net)\/)/, "://i$1/");

    // redtube.com
    // http://img02.redtubefiles.com/_thumbs/0000442/0442998/1234567_015m.jpg becomes
    // http://img02.redtubefiles.com/_thumbs/0000442/0442998/1234567_015i.jpg
    // more recently,
    // http://mimg06.redtubefiles.com/m=e0YH8f/_thumbs/0000615/0111111/0611111_002m.jpg becomes
    // http://mimg06.redtubefiles.com/_thumbs/0000615/0615297/0615297_002i.jpg
    // disabled since while hovering a thumb on their site, losing
    // focus causes their animated thumb to scroll very quickly.
    // aImageSrc = aImageSrc.replace(/(redtubefiles\.com\/).*(_thumbs\/.*)[im](\.jpg)/,
    //                               "$1$2i$3");
                                  
    // pixiv.net
    // http://img29.pixiv.net/img/puppy/12345678_s.jpg becomes
    // http://img29.pixiv.net/img/puppy/12345678_m.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(pixiv.net/.*img/.*)_s(" + 
                                             EXTS + ")", "i"),
                                             "$1_m$2");
                                             
    // http://img01.pixiv.net/img/ajoritas/1234567_100.jpg?ctype=ranking becomes
    // http://img01.pixiv.net/img/ajoritas/1234567_m.jpg?ctype=ranking ; 
    // http://i1.pixiv.net/img83/img/luminocity/mobile/31245427_128x128.jpg becomes
    // http://i1.pixiv.net/img83/img/luminocity/31245427.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(pixiv.net/img/.*?)(\/mobile)?\/_[0-9]{2,3}(?:x[0-9]{2,3})?(" + 
                                             EXTS + ")", "i"),
                                             "$1_m$2");
    
    // pixiv.com
    // http://i2.pixiv.net/img91/works/186x186/px7700ms/31423062_m.jpg becomes
    // http://i1.pixiv.net/img91/img/px7700ms/31423062_m.jpg
    // xuite.net
    // http://c.share.photo.xuite.net/konwewe/1c8dee9/5609298/217205911_c.jpg becomes
    // http://c.share.photo.xuite.net/konwewe/1c8dee9/5609298/217205911_x.jpg
    aImageSrc = aImageSrc.replace(/(:\/\/[^/]*photo\.xuite\.net\/.*\/[0-9]+)_[a-z]\.jpg/i, 
                                  "$1_x.jpg");

    // safebooru.org and others
    // http://safebooru.org/thumbnails/983/thumbnail_ff1c7d20d45cec36eab76f78e3fd36d6.jpeg?988584 becomes
    // http://safebooru.org/images/983/ff1c7d20d45cec36eab76f78e3fd36d6.jpeg?988584
    aImageSrc = aImageSrc.replace(/\/thumbnails\/+([0-9]+)\/thumbnail_([0-9a-f]+\.)/i,
                                  "/images/$1/$2");
    
    // photo.net
    // http://static.photo.net/thumbnails/97/42/9742906-tn-lg.jpg becomes
    // http://gallery.photo.net/photo/9742906-lg.jpg
    // http://thumbs.photo.net/photo/14271073-sm.jpg becomes
    // http://gallery.photo.net/photo/14271073-lg.jpg
    aImageSrc = aImageSrc.replace(/(:\/\/)(?:static|thumbs)\.photo\.net\/.*\/(.*?)-(?:tn-)?[a-z0-9]*\.jpg/i, 
                                  "$1gallery.photo.net/photo/$2-lg.jpg");
    
    // redbox.com
    // http://images.redbox.com/Images/EPC/Thumb150/5584.jpg becomes
    // http://images.redbox.com/Images/EPC/Detail370/5584.jpg
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(/^(https?:\/\/images\.redbox\.com\/Images\/EPC)\/Thumb[0-9]+\/([0-9]+\.jpg)$/i,
                                  "$1/Detail370/$2");
    if (before != aImageSrc) {
      flags.popupAvoiderLREdge = 1;
      flags.popupAvoiderWidth = 422;
    }
    
    // weheartit.com uses 
    // http://data.whicdn.com/images/24321233/6cj4w2c9qtgj_large.jpg ->
    // http://data.whicdn.com/images/24321233/6cj4w2c9qtgj_thumb.jpg
    aImageSrc = aImageSrc.replace(/(data\.whicdn\.com\/images\/.*)_thumb\.jpg/,
                                  "$1_large.jpg");
    
    // favim.com:
    // http://s3.favim.com/mini/42/kiss-love-percabeth-percy-jackson-358770.jpg becomes
    // http://s3.favim.com/orig/42/kiss-love-percabeth-percy-jackson-Favim.com-358770.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.favim\\.com)/(?:mini|micro)/(.*[/-])([0-9]+" + EXTS + ")"),
                                  "$1/orig/$2Favim.com-$3");
                                  
    // Huffingtonpost.com
    // http://i.huffpost.com/gen/574638/thumbs/s-MILA-KUNIS-WITHOUT-MAKEUP-154x114.jpg becomes
    // http://i.huffpost.com/gen/574638/thumbs/o-MILA-KUNIS-WITHOUT-MAKEUP-570.jpg
    // can also be -mini, -small.  Note that occasionally o-*570 doesn't exist,
    // but s-*large does.  We fail in that case.
    // .../a- case seen on aol.com
    aImageSrc = aImageSrc.replace(/^(https?:\/\/i.huffpost.com\/gen\/.*\/thumbs)\/[as]-(.*)-(mini|small|large|[0-9]+x[0-9]+)[0-9]*\.jpg/i,
                                  "$1/o-$2-570.jpg");
    // http://i.huffpost.com/gen/576806/thumbs/r-SECRET-LIVES-OF-MOMS-medium260.jpg becomes
    // http://i.huffpost.com/gen/576806/thumbs/o-SECRET-LIVES-OF-MOMS-570.jpg
    aImageSrc = aImageSrc.replace(/^(https?:\/\/i.huffpost.com\/gen\/.*\/thumbs)\/r-(.*)-(mini|small|medium|large)[0-9]*\.jpg/i,
                                  "$1/o-$2-570.jpg");

    // smugmug.com
    // http://fotomom.smugmug.com/Daily-Photos/My-Best-Daily-Shots/i-NV2b7Mx/0/Ti/IMG5190Cropped8X10-Ti.jpg becomes
    // http://fotomom.smugmug.com/Daily-Photos/My-Best-Daily-Shots/i-NV2b7Mx/0/L/IMG5190Cropped8X10-L.jpg
    // or src as Th; or dest as X1, X3, or X3 instead of L.
    // Can be on other domains like on http://www.duffyknox.com/Personal/sports/Zion-Memorial-Day-adventure/23261775_gtCnDp#!i=1876521503&k=65764hV
    aImageSrc = aImageSrc.replace(new RegExp("(/[0-9]+/)T[hi](/.*-)T[hi](-.*)?(" + 
                                             EXTS + ")"),
                                  "$1X2$2X2$3$4");
                                  
    // http://papanaturephotography.smugmug.com/Flowers/Papa-Nature-Photography/DSC5217pscrop/804122257_FaNFY-Ti-2.jpg becomes
    // http://papanaturephotography.smugmug.com/Flowers/Papa-Nature-Photography/DSC5217pscrop/804122257_FaNFY-L-2.jpg
    aImageSrc = aImageSrc.replace(new RegExp("^(https?://[^/]*\\.smugmug\\.com/.*-)T[hi](-.*)?(" + 
                                             EXTS + ")"),
                                  "$1X2$2$3");
                                  
    // coppermine gallery, e.g.
    // http://coppermine-gallery.net/demo/cpg15x/ or
    // http://photo.net.ph/albums/userpics/10002/thumb_DSCN5416a.jpg becomes
    // http://photo.net.ph/albums/userpics/10002/DSCN5416a.jpg
    // album names can vary or be nested.
    // http://media.animegalleries.net/albums/rosario_vampire/moka_akashiya/thumb_rosario_moka_0192.jpg becomes
    // http://media.animegalleries.net/albums/rosario_vampire/moka_akashiya/rosario_moka_0192.jpg
    // 
    aImageSrc = aImageSrc.replace(/(\/albums\/[^?&]+\/)thumb_([^?&\/]+\.(jpg|png|gif))/i, 
                                  "$1$2");
    
    // Powered by PhotoPost vBGallery, eg
    // http://www.hondahookup.com/gallery/files/5/2/4/5/9/9/img_20120513_133135_thumb.jpg becomes
    // http://www.hondahookup.com/gallery/files/5/2/4/5/9/9/img_20120513_133135.jpg
    // and parent <a> tag includes "showimage.php".
    // This rule works for many sites, but some images have .jpg in thumb but .JPG in image.
    let photoPostRegEx = new RegExp("(/[0-9]+/.*)_thumb(" + 
                                    EXTS + ")");
    if (photoPostRegEx.test(aImageSrc)) {
      let parentName = String(node.parentNode)
      if (/showimage\.php/.test(parentName)) {
        aImageSrc = aImageSrc.replace(photoPostRegEx, "$1$2");
      }     
    }
    
    //
    aImageSrc = aImageSrc.replace(new RegExp("(tyimg\\.com/thumb)/[a-z]/[a-z]_(.*" + 
                                             EXTS + ")"),
                                  "$1/l/l_$2");
                                  
    // phpThumb (on various sites).  You can test it here if you turn off
    // the Others rule and on the Thumbnails rule (since the site's links are
    // bad): http://phpthumb.sourceforge.net/demo/demo/phpThumb.demo.demo.php
    // eg:
    // http://timmy/phpThumb/phpThumb.php?w=80&h=60&f=png&src=http://timmy/timmy/emp_pix/110024668.jpeg becomes
    // http://timmy/timmy/emp_pix/110024668.jpeg, or
    // http://phpthumb.sourceforge.net/demo/phpThumb.php?src=images/animaple.gif&w=25&f=gif&hash=30654d06a0e509eca0d14d08bf2f01d8 becomes
    // http://phpthumb.sourceforge.net/demo/images/animaple.gif
    before = aImageSrc;
    match = /\/phpThumb\.php.*[?&]src=([^&]*)/i.exec(aImageSrc);
    if (match) {
      aImageSrc = decodeURIComponent(match[1]);
      aImageSrc = ThumbnailZoomPlus.FilterService._applyThisBaseURI(node.ownerDocument, before, aImageSrc);
    }
    
    // patch.com (and possily others)
    // http://o1.aolcdn.com/dims-shared/dims3/PATCH/thumbnail/178x88/crop/88x88+45+0/http://hss-prod.hss.aol.com/hss/storage/patch/c7157cb57f56381e37cae1012e591285 becomes
    // http://hss-prod.hss.aol.com/hss/storage/patch/c7157cb57f56381e37cae1012e591285
    //
    // http://o1.aolcdn.com/dims-shared/dims3/PATCH/resize/273x203/http://hss-prod.hss.aol.com/hss/storage/patch/c7157cb57f56381e37cae1012e591285 becomes
    // http://hss-prod.hss.aol.com/hss/storage/patch/c7157cb57f56381e37cae1012e591285
    //
    // http://o.aolcdn.com/dims-shared/dims3/PATCH/format/jpg/quality/82/resize/108x72%5E/crop/108x72%2B1%2B0/http://hss-prod.hss.aol.com/hss/storage/patch/afb5a18780fc705d602fefcb75fab709
    match = /\/(?:resize|thumbnail)\/.*(?:\/crop\/.*)?\/(https?:\/\/.*)/.exec(aImageSrc);
    if (match) {
      aImageSrc = match[1];
    }
    
    // nytimes.com:
    // http://graphics8.nytimes.com/images/2012/06/22/us/JASPER-3/JASPER-3-articleInline.jpg becomes
    // http://graphics8.nytimes.com/images/2012/06/22/us/JASPER-3/JASPER-3-popup.jpg ,
    // http://i1.nyt.com/images/2012/06/22/theater/22MOTH_ASYOU/22MOTH_ASYOU-moth.jpg becomes
    // http://graphics8.nytimes.com/images/2012/06/22/arts/22ASYOU_SPAN/22ASYOU_SPAN-articleLarge.jpg (removes MOTH_)
    // http://i1.nyt.com/images/2012/06/22/arts/22MOTH_HOT/22MOTH_HOT-moth.jpg becomes
    // http://graphics8.nytimes.com/images/2012/06/22/arts/22HOT/22HOT-popup.jpg (removes MOTH_)
    // Some URLs become _SPAN-articleLarge but how do we know which?
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(/(\.(?:nytimes|nyt)\.com\/images\/.*)-(articleInline|moth|thumbStandard|custom[0-9]*|blog[0-9]*)/,
                                  "$1-popup");
    aImageSrc = aImageSrc.replace(/(\.(?:nytimes|nyt)\.com\/images\/.*)-(videoThumb|sfSpan|hpMedium)/,
                                  "$1-articleLarge");
    if (before != aImageSrc) {
      aImageSrc = aImageSrc.replace(/MOTH_/g, "");
      // We don't always know which of -popup or -articleLarge to use.  Our
      // framework doesn't support trying both, so suppress the error indicator.
      flags.noErrorIndicator = true;
    }
    
    // Yelp.com
    // http://s3-media1.fl.yelpassets.com/bphoto/DGiSmoeSo6zcodTzmtlirw/ls.jpg becomes
    // http://s3-media1.fl.yelpassets.com/bphoto/DGiSmoeSo6zcodTzmtlirw/o.jpg
    // http://s3-media3.ak.yelpcdn.com/photo/QlW1MqiLb7wRp_7NRJxt_w/xs.jpg becomes
    // http://s3-media3.ak.yelpcdn.com/photo/QlW1MqiLb7wRp_7NRJxt_w/l.jpg
    // Sometimes we see numbers before the file size code, eg 258s.
    let yelpRe = new RegExp("(\\.(?:yelpcdn|yelpassets)\\.com/.*)/[0-9]*(?:xss|xs|ss|s|m|ms|l|ls)(" +
                            EXTS + ")", "i");
    aImageSrc = aImageSrc.replace(yelpRe, "$1/o$2");
    ThumbnailZoomPlus.Pages._logger.debug("yelp expr: " + yelpRe);

    // Tripadvisor.com
    // http://media-cdn.tripadvisor.com/media/photo-l/01/f8/09/8a/hotel-pool.jpg becomes
    // http://media-cdn.tripadvisor.com/media/photo-s/01/f8/09/8a/hotel-pool.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.tripadvisor\\.com/media)/photo-[a-z]+/(.*" +
                                             EXTS + ")","i"),
                                  "$1/photo-s/$2");
    // http://media-cdn.tripadvisor.com/media/ProviderThumbnails/dirs/67/2b/672b18107d093b8e21f22da3dca956f92.jpg becomes
    // http://media-cdn.tripadvisor.com/media/ProviderThumbnails/dirs/67/2b/672b18107d093b8e21f22da3dca956f92large.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.tripadvisor\\.com/media/.*/[0-9a-f]+)(?:small|)(" +
                                             EXTS + ")", "i"),
                                  "$1large$2");
    // Tripadvisor uses flipkey.com for vacation rentals.
    // http://images4.flipkey.com/img/photos/losangelesguestsuites/westhollywood3bedroom2bathroom/micro_losangelesguestsuites-westhollywood3bedroom2bathroom-003-1309232550.jpg becomes
    // http://images4.flipkey.com/img/photos/losangelesguestsuites/westhollywood3bedroom2bathroom/640x480_losangelesguestsuites-westhollywood3bedroom2bathroom-003-1309232550.jpg
    aImageSrc = aImageSrc.replace(new RegExp("(\\.flipkey\.com/img/photos/.*)/(?:micro|regular|large)_(.*" + 
                                  EXTS + ")", "i"),
                                  "$1/640x480_$2");

    // redfin.com: property thumb from list of properties:
    // http://media.cdn-redfin.com/photo/40/tmbphoto/533/genTmb.12-614533_0.jpg becomes
    // http://media.cdn-redfin.com/photo/40/bigphoto/533/12-614533_0.jpg
    aImageSrc = aImageSrc.replace(/(cdn-redfin\.com\/photo\/.*)\/tmbphoto\/(.*)\/genTmb./,
                                  "$1/bigphoto/$2/");

    // kickstarter.com
    // http://s3.amazonaws.com/ksr/projects/262400/photo-little.jpg?1342591916 becomes
    // http://s3.amazonaws.com/ksr/projects/262400/photo-full.jpg?1342591916
    aImageSrc = aImageSrc.replace(/(\.amazonaws\.com\/ksr\/.*photo)-little\./,
                                  "$1-full.");
    // http://s3.amazonaws.com/ksr/photos/122/oreilly-sq.jpg.large_thumb.jpg becomes
    // http://s3.amazonaws.com/ksr/photos/122/oreilly-sq.jpg.full.jpg
    aImageSrc = aImageSrc.replace(/(\.amazonaws\.com\/ksr\/.*)\.large_thumb\./,
                                  "$1.full.");
    
    // http://s3.amazonaws.com/ksr/avatars/3635050/IMG_2118.small.jpg?1347378222 becomes
    // http://s3.amazonaws.com/ksr/avatars/3635050/IMG_2118.large.jpg?1347378222
    aImageSrc = aImageSrc.replace(/(\.amazonaws\.com\/ksr\/.*)\.small\./,
                                  "$1.large.");
    
    // itunes: music becomes 600x600; others remove resolution.
    // find example pages by searching 'mozart' on main itunes.com page.  eg
    // https://itunes.apple.com/us/artist/academy-st.-martin-in-fields/id6783956?ign-mpt=uo%3D4
    // http://a5.mzstatic.com/us/r1000/092/Music/6c/ed/86/mzi.oltlbval.170x170-75.jpg becomes
    // http://a5.mzstatic.com/us/r1000/092/Music/6c/ed/86/mzi.oltlbval.600x600-75.jpg
    // http://a5.mzstatic.com/us/r1000/090/Video/v4/40/e1/fa/40e1fa55-b9fc-a05f-2e9f-dc98ff836cd5/mza_3406439828248633386.227x227-75.jpg becomes
    // http://a5.mzstatic.com/us/r1000/090/Video/v4/40/e1/fa/40e1fa55-b9fc-a05f-2e9f-dc98ff836cd5/mza_3406439828248633386.jpg
    // more recently (11/2014):
    // http://a3.mzstatic.com/us/r30/Music/v4/83/90/6d/83906dbe-1b14-a543-cc0d-205fd7502347/cover100x100.jpeg becomes
    // http://a3.mzstatic.com/us/r30/Music/v4/83/90/6d/83906dbe-1b14-a543-cc0d-205fd7502347/cover600x600.jpeg
    before = aImageSrc;
    aImageSrc = aImageSrc.replace(/(\.mzstatic\.com\/.*\/Music[0-9]*\/.*)\.[0-9]{2,4}x[0-9]{2,4}(-[0-9]{1,3}\.jpe?g)/,
                                  "$1.600x600$2");
    if (before == aImageSrc) {
      aImageSrc = aImageSrc.replace(/(\.mzstatic\.com\/.*)\.[0-9]{2,4}x[0-9]{2,4}-[0-9]{1,3}(\.jpe?g)/,
                                    "$1$2");
    }
    aImageSrc = aImageSrc.replace(/(\.mzstatic\.com\/.*\/Music[0-9]*\/.*?)[0-9]{2,3}x[0-9]{2,3}(\.jpe?g)/,
                                  "$1600x600$2");
                                  
    // Apply Facebook rule to improve if we've gotten a small Facebook thumb,
    // e.g. on pandora.com.
    // TODO: need to see if this would still work.  Don't have pageSpecificData.
    // getZoomImage may expect a different kind of node.
    // aImageSrc = _getZoomImageViaPage(ThumbnailZoomPlus.Pages.Facebook.aPage, node, aImageSrc);


    // Using the thumb itself as source; don't annoy the user with
    // "too small" warnings, which would be quite common.
    // flags.noTooSmallWarning = true;

    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p99: so far have " + aImageSrc);

    if (originalImageSrc == aImageSrc) {
      // Don't return the unmodified image URL as the result since that's
      // reserved for the ThumbnailItself rule.  This allows the Thumbnail
      // rule to run before OthersIndirect, and not have same-size thumbs
      // prevent OthersIndirect from running, while still allowing
      // (potentially same-size) thumbs to be handled if OthersIndirect
      // doesn't find anything.
      return null;
    }
    return aImageSrc;
  }
};


/**
 * ThumbnailItself: returns the thumbnail itself as the image source.
 */
ThumbnailZoomPlus.Pages.ThumbnailItself = {
  key: ThumbnailZoomPlus.Pages.Thumbnail.key,
  name: "", // Set in ENTITY_page_thumbnail.

  // Copy several fields from the Thumbnail rule.  
  host: ThumbnailZoomPlus.Pages.Thumbnail.host,
  hostDisallow: ThumbnailZoomPlus.Pages.Thumbnail.hostDisallow,
  imageRegExp: ThumbnailZoomPlus.Pages.Thumbnail.imageRegExp,
  imageDisallowRegExp : ThumbnailZoomPlus.Pages.Thumbnail.imageDisallowRegExp,

  getImageNode : ThumbnailZoomPlus.Pages.Thumbnail.getImageNode,  

  // For "Thumbnail Itself"
  getZoomImage : function(aImageSrc, node, flags) {
    let verbose = false;
    
    let nodeName = node.localName.toLowerCase();
    let nodeClass = node.getAttribute("class");
    ThumbnailZoomPlus.Pages._logger.debug("getZoomImage ThumbnailItself for " + nodeName 
                                          + " class='" + nodeClass + "'" +
                                          " baseURI=" + node.baseURI);

    aImageSrc = ThumbnailZoomPlus.Pages.Thumbnail.getInitialImageSrc(aImageSrc, node);

                                  
    // Using the thumb itself as source; don't annoy the user with
    // "too small" warnings, which would be quite common.
    flags.noTooSmallWarning = true;

    if (verbose) ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage p99: so far have " + aImageSrc);

    return aImageSrc;
  }

};
