/**
 * Copyright (c) 2010 Andres Hernandez Monge
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

Cu.import("resource://thumbnailzoomplus/common.js");

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

ThumbnailZoomPlus.Pages._imageTypesRegExpStr = "(?:\\.gif|\\.jpe?g|\\.png|\\.bmp|\\.svg)";

/***********
  Define rules for each page.
  
  Each page is an object such as ThumbnailZoomPlus.Pages.Facebook, which
  is stored as an element in ThumbnailZoomPlus.FilterService.pageList[].

  Fields:

    * key: a unique lower-case string which identifies the rule in preferences
      and elsewhere.  eg "facebook"

    * name: user-visible rule name, often starting with captial letter.  Appears
      .g. in the tool menu's checkboxes.  eg "Facebook".

    * host: regular expression which the hostname of the page containing the
      thumbnail or link must match for the rule to apply.  THIS APPLIS
      TO THE PAGE WHICH HOSTS THE LINK OR THUMB, NOT THE IMAGE ITSELF.
      Remember to backslash-quote literal dots.  eg /^(.*\.)?facebook\.com$/

    * imageRegExp: the popup image URL produced by the rule must match this 
      pattern or else it'll be rejected.  Helps prevent error icon from appearing
      due to generating an image URL which isn't really an image.
      eg /profile|\/app_full_proxy\.php|\.(fbcdn|akamaihd)\.net\/.*(safe_image|_[qstan]\.|([0-9]\/)[qsta]([0-9]))/

    * getSpecialSource: optional function(aNode, aNodeSource); returns
      new value of aNodeSource (image URL).  Called before getImageNode().
      Not called when user hovers directly over an img since we use that
      as the source automatically.  Returning null prevents popup.
       
    * getImageNode: optional function(aNode, nodeName, nodeClass).  Returns the
      node from which the popup image's link will be generated.  Useful when
      it's generated not from the direct thumbnail image, but an ancestor or
      peer node.  The image URL will be extracted (in fiterService.js) from the 
      returned node's src, href, or background image.  The default function returns
      the image node itself.  Called only if we don't already have an image
      source after calling getSpecialSource.  Not called when the user hovers
      directly over an img or when getSpecialSource returns non-null.  So it
      may not be safe to use this to REJECT a node; do that in getZoomImage
      instead.

    * getZoomImage: required function(aImageSrc, node, popupFlags); returns the image URL.
      Translates the aImageSrc URL from the previous functions into the final
      URL of the full-size image for the popup, for example by
      removing ".thumb" from the URL.  Returns null if it can't produce a 
      valid full-size image URL from the specified aImageSrc, or "" if it
      can't because the user has disabled some other page related to the URL.
      Function can optionally modify members of flags, which is of class
      ThumbnailZoomPlus.FilterService.PopupFlags.  node is the node the user
      hovered, useful e.g. if you want to check its class.

    * aPage: the index of this page in 
      ThumbnailZoomPlus.FilterService.pageList[].  Not set in pages.js; 
      assigned by calculation in filterService.js.

 ***********/

/**
 * Facebook
 */
ThumbnailZoomPlus.Pages.Facebook = {
  key: "facebook",
  name: "Facebook",
  host: /^(.*\.)?facebook\.com$/,
  /*
     Thumb URLs seem different when logged into Facebook vs when logged out
     and refreshed.  When logged in I see akamaihd; when logged out I see fbcdn.
     test e.g. at https://www.facebook.com/Levis?sk=wall

     Example image URLs:
     https://s-external.ak.fbcdn.net/safe_image.php?d=AQBTSEn7MQEFZ1lI&w=90&h=90&url=http%3A%2F%2Fmy.eimg.net%2Fharvest_xml%2FNEWS%2Fimg%2F20111128%2Fa81e4575-1079-4efd-b650-59d72173f185.jpg
     https://fbcdn-photos-a.akamaihd.net/hphotos-ak-ash4/260453_10150229109580662_95181800661_7448013_4160400_s.jpg
     
     https://www.facebook.com/app_full_proxy.php?app=143390175724971&v=1&size=z&cksum=52557e63c5c84823a5c1cbcd8b0d0fe2&src=http%3A%2F%2Fupload.contextoptional.com%2F20111205180038358277.jpg
   */
  imageRegExp: /profile|\/app_full_proxy\.php|\.(fbcdn|akamaihd)\.net\/.*(safe_image|_[qstan]\.|([0-9]\/)[qsta]([0-9]))/,
  getImageNode : function(aNode, aNodeName, aNodeClass) {
    let image = ("i" == aNodeName ? aNode : 
                 ("a" == aNodeName && "album_link" == aNodeClass) ? aNode.parentNode :
                  null);
    return image;
  },
  
  getSpecialSource : function(aNode, aNodeSource) {
    let imageSource = aNodeSource;
    let rex = new RegExp(/static\.ak\.fbcdn\.net/);
    if (rex.test(aNodeSource)) {
      // Facebook photos sometimes use an <i> tag with the image
      // displayed via a style with background-image.
      if (-1 == aNode.style.backgroundImage.indexOf("url")) {
        imageSource = aNode.nextSibling.getAttribute("src");
      } else {
        imageSource = aNode.style.backgroundImage.
          replace(/url\(\"/, "").replace(/\"\)/, ""); /* help Xcode syntax highlighting: "))) */
      }
    }
    return imageSource;
  },
  
  getZoomImage : function(aImageSrc, node, flags) {
    let aNodeClass = node.getAttribute("class");
    ThumbnailZoomPlus.Pages._logger.debug("facebook getZoomImage: node=" +
                                          node + "; class=" +
                                          aNodeClass);
    if (aNodeClass == "spotlight") {
      // Disable for lightbox view since popup covers tags in lightbox
      // image and comments, and lightbox image is already pretty large.
      return null;
    }
    if (aNodeClass && aNodeClass.indexOf("actorPic") >= 0) {
      // Don't show popup for small Facebook thumb of the person who's
      // entering a comment since the comment field loses focus and the 
      // thumbnails disappears, which is confusing.
      return null;
    }
    
    // Handle externally-linked images.
    let rexExternal = /.*\/safe_image.php\?(?:.*&)?url=([^&]+).*/;
    if (rexExternal.test(aImageSrc)) {
      let image = aImageSrc.replace(rexExternal, "$1");
      image = decodeURIComponent(image);
      return image;
    }

    let appRex = /.*\/app_full_proxy.php\?.*&src=([^&]+)$/;
    if (appRex.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(appRex, "$1");
      aImageSrc = decodeURIComponent(aImageSrc);
      return aImageSrc;
    }
    
    // Check the thumbnail against rex1
    let rex1 = new RegExp(/_[qstan]\./);
    let rex2 = new RegExp(/([0-9]\/)[qsta]([0-9])/);
    // Apply replacement for rex1 or rex2; reject if neither matches.
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "_n.") :
                (rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "$1n$2") : null));
    if (image == null) {
      return null;
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
    let rex3 = new RegExp(/\/s[0-9]+x[0-9]+\//);
    image = image.replace(rex3, "/");
    return image;
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
  host: /^(.*\.)?(twitpic\.com|twitpicproxy.com|twitter\.com|twimg)$/,
  imageRegExp:
    /^(.*[.\/])?(twimg[.0-9-].*|twitpic\.com(?:\/).*\/([a-z0-9A-Z]+)$|yfrog.com|instagr\.am|instagram.com|twitpicproxy\.com)/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/[:_](thumb|bigger|mini|normal|reasonably_small)(?![^.])/);
    let rex2 = new RegExp(/-(mini|thumb)\./);
    let rex3 = new RegExp(/\/(mini|thumb|iphone|large)\//);
    let rex4 = new RegExp(/\?size=t/);
    let rexNoModNecessary = new RegExp(/(\/large\/|yfrog\.com|instagr\.am|instagram.com|twimg)/);
    
    /*
     * We could resolutions to "large".  Another option is "full", which is bigger,
     * but the server seems quite slow and "full" could take several seconds to
     * load even on a high-speed connection.
     * But some images have "full" size but not "large" size.
     * Ideally we'd try "large" but if it fails, try "full".
     * For now we use "full" to assure we get something, but it may be slow.
     */
    let image = rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "") :
                rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "-full.") : 
                rex3.test(aImageSrc) ? aImageSrc.replace(rex3, "/full/") : 
                rex4.test(aImageSrc) ? aImageSrc.replace(rex4, "?size=f") :
                rexNoModNecessary.test(aImageSrc) ? aImageSrc :
                null;
    if (image == null) {
      return null;
    }

    if (false) {
      // This is disabled because while it may sometimes help, more often it 
      // fails, adding .jpg where the image actually shouldn't have any suffix.
      // If we could return multiple filenames, we could use this logic.
      
      // If site is twimg or twitpic, make sure it has an image extension (.jpg default).
      // But not for profile_images, which actually sometimes don't have a suffix.
      let suffixRegex = new RegExp(ThumbnailZoomPlus.Pages._imageTypesRegExpStr, "i");
      if (/twitpic\.com|twimg/.test(image) &&
          ! suffixRegex.test(image) &&
          ! /\/profile_images\//.test(image)) {
        image += ".jpg";
      }
    }
    
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
  imageRegExp: /^((?!.*g-ecx\.).*\.)(ssl-)?images\-amazon\.com\/images\/(?!.*(buttons|gui)\/).*/,

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
  imageRegExp: /(photos[0-9]+|pics)\.hi5\.com/,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/\-01\./);
    let rex2 = new RegExp(/\.small\./);
    let image = (rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "-02.") :
      (rex2.test(aImageSrc) ? aImageSrc.replace(rex2, ".") : null));
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
  getSpecialSource : function(aNode, aNodeSource) {
    let imageSource = (aNode.hasAttribute("data-src") ?
      aNode.getAttribute("data-src") : aNodeSource);
    return imageSource;
  },
  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/(\/|\_)[sml]\./i);
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
  host: /^(.*\.)?netflix\.com$/,
  imageRegExp: new RegExp("://movies\\.netflix\\.com/WiPlayer\\?movieid=|" +
                          "://movies\\.netflix\\.com/WiMovie/.*/([0-9]+)\\?.*|" +
                          "\\.nflximg\\.com/.*" + ThumbnailZoomPlus.Pages._imageTypesRegExpStr + "$"),
                          
  getImageNode : function(aNode, nodeName, nodeClass) {
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
    let netflixRex1 = new RegExp("(\.nflximg.com/.*/boxshots)/(large|small|[0-9]+)/");
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
    let netflixRex3 = new RegExp(".*//movies\\.netflix\\.com/WiPlayer\\?movieid=([0-9]+).*");
    let netflixRex4 = new RegExp(".*//movies\\.netflix\\.com/WiMovie/.*/([0-9]+)\\?.*");
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
  imageRegExp: /farm[0-9]+\.static\.?flickr\.com|l.yimg.com\/g\/images\/spaceout.gif/,
  getSpecialSource : function(aNode, aNodeSource) {
    let imageSource = (-1 != aNodeSource.indexOf("spaceball.gif") ?
      aNode.parentNode.previousSibling.firstChild.firstChild.getAttribute("src")
      : aNodeSource);
    if (-1 != aNodeSource.indexOf("spaceout.gif")) {
      imageSource = aNode.parentNode.parentNode.firstChild.firstChild.getAttribute("src");
    }
    return imageSource;
  },
  getZoomImage : function(aImageSrc, node, flags) {
    // match an image name with a s, m, or t size code, or no size code, e.g.
    // http://farm2.staticflickr.com/1120/1054724938_a67ff6eb04_s.jpg or
    // http://farm2.staticflickr.com/1120/1054724938_a67ff6eb04.jpg
    let rex = new RegExp(/(?:_[a-z])?(\.[a-z]+)$/);
    // Substitute to the letter code for the desired size (_z=Medium_640).
    // It's tempting to use a code for a larger size, but some images aren't
    // available in larger size, causing them to get no popup at all if we change
    // it.
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "_z$1") : null);

    return image;
  }
};

/**
 * Wikipedia
 */
ThumbnailZoomPlus.Pages.Wikipedia = {
  key: "wikipedia",
  name: "Wikipedia",
  host: /^(.*\.)?wikipedia\.org$/,
  
  /*
     Examples:
       http://upload.wikimedia.org/wikipedia/en/thumb/e/ef/Indus_River_Delta.jpg/100px-Indus_River_Delta.jpg becomes
       http://upload.wikimedia.org/wikipedia/en/e/ef/Indus_River_Delta.jpg
       
       http://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Ernest_Hemingway_Kenya_safari_1954.png/100px-Ernest_Hemingway_Kenya_safari_1954.png becomes
       http://upload.wikimedia.org/wikipedia/commons/3/3f/Ernest_Hemingway_Kenya_safari_1954.png

       http://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Haute-Vienne-Position.svg/250px-Haute-Vienne-Position.svg.png becomes
       http://upload.wikimedia.org/wikipedia/commons/e/e6/Haute-Vienne-Position.svg   
   */
  imageRegExp: new RegExp("upload\\.wikimedia\\.org/wikipedia/.*" +
                          ThumbnailZoomPlus.Pages._imageTypesRegExpStr + 
                          "(/.*)?$", "i"),
  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/\/thumb\//);
    let rex2 = new RegExp(/(\.[a-z]+)\/\d+px-.+\.[a-z.]+/i);
    let rex3 = new RegExp(/\.svg$/i);
    let image =
      (rex1.test(aImageSrc) && rex2.test(aImageSrc) && !rex3.test(aImageSrc) ?
       aImageSrc.replace(rex1, "/").replace(rex2,"$1") : null);
    return image;
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
  //
  // Note: doesn't currently work for gifs since multiple parts of their URLS change and
  // I don't know how to predict that, e.g.
  //   http://fc06.deviantart.net/fs70/i/2011/331/1/4/charmander_the_stray_by_brittanytucker-d4hijn7.gif to
  //   http://fc04.deviantart.net/fs70/f/2011/331/b/3/charmander_the_stray_by_brittanytucker-d4hijn7.gif
  key: "deviantart",
  name: "deviantART",
  host: /^(.*\.)?deviantart\.com$/,
  imageRegExp: /(th[0-9]+|[as])\.deviantart\.(net|com)\/.*\/\d+[A-Za-z]?(\/[fiop]\/[0-9])/,
  getZoomImage : function(aImageSrc, node, flags) {
    let picRex = new RegExp(/\/\d+[A-Za-z]?(\/[fiop]\/[0-9])/);
    let image = (picRex.test(aImageSrc) ? aImageSrc.replace(picRex, "$1") : 
                 null);
    return image;
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
  imageRegExp: /^https?:\/\/[^\/]*\.okccdn\.com\/.*\/images\/.*\/[0-9]+\.(jpe?g|png|gif)$/i,
  getZoomImage : function(aImageSrc, node, flags) {
    // http://ak1.okccdn.com/php/load_okc_image.php/images/160x160/160x160/189x210/687x708/2/17985133630795268990.jpeg
    let picRex = new RegExp(/^(.*\.okccdn\.com\/.*\/images\/)[0-9x\/]*\/([0-9]+\.(jpe?g|png|gif))$/);
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
  imageRegExp: /[0-9]+\.photobucket.com\/(albums|groups)/,
  getImageNode : function(aNode, aNodeName, aNodeClass) {
    return ("div" == aNodeName && "thumb" == aNodeClass ? aNode : null);
  },
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
  imageRegExp: /.*\/media-[^.\/]*\.pinterest\.com\/(upload|avatars)\/.*/,
  getZoomImage : function(aImageSrc, node, flags) {
    // for images:
    let rex = new RegExp("([0-9_a-zA-Z]+_)b(" + 
                         ThumbnailZoomPlus.Pages._imageTypesRegExpStr + ")");
    aImageSrc = aImageSrc.replace(rex, "$1f$2");

    // for avatars:
    // http://media-cdn.pinterest.com/avatars/ohjoy-18.jpg becomes
    // http://media-cdn.pinterest.com/avatars/ohjoy-18_o.jpg
    rex = new RegExp("(/avatars/.*)(\\.jpg)$")
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
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/serve\/\w+\//);
    let image =
      (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/serve/_/") : null);
    return image;
  },
  getImageNode : function(aNode, aNodeName, aNodeClass) {
    let image = null;
    if ("span" == aNodeName  && aNode.previousSibling) {
      if ("overlay" == aNodeClass) {
        image = aNode.previousSibling.firstChild;
      } else if ("jewelcase" == aNodeClass) {
        image = aNode.previousSibling;
      }
    }
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
    
    // example photo thumb: https://lh6.googleusercontent.com/-sHGfoG3xxXX/TnlXXz7dHmI/AAXXAAAAAI8/upXXI3JTguI/w402/065.JPG
    // corresponding large image: https://lh6.googleusercontent.com/-sHGfoG3xxXX/TnlXXz7dHmI/AAXXAAAAAI8/upXXI3JTguI/065.JPG
    // the w402 field supports arbitrary width, height, and size specifications with
    // w###, h###, s###.  I've also seen a "-k" suffix.
    //
    let rex1 = new RegExp(/\/(([swh][0-9]+|-[a-z])-?)+\//);
    if (rex1.test(aImageSrc)) {
      this._logger.debug("matched google+ non-profile photo");
      return aImageSrc.replace(rex1, "/");
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
  name: "", // Set in ENTITYgoogle.
  
  // host is all of Google so it can work on images.google.com, 
  // www.google.com general search with image results, etc.
  // To prevent this from interfering with GooglePlus, its entry
  // comes later in filterService.js.
  host: /^((?!picasaweb).*\.google(\.com)?\.[a-z]+)$/,
  imageRegExp: /^https?:\/\//,
  getSpecialSource : function(aNode, aNodeSource) {
    let imageSource = null;
    let imageHref = aNode.parentNode.getAttribute("href");
    if (null != imageHref) {
      let imageIndex = imageHref.indexOf("imgurl=");
      if (-1 < imageIndex) {
        imageSource = imageHref.substring(imageIndex + 7);
        imageIndex = imageSource.indexOf("&");
        if (-1 < imageIndex) {
          imageSource = imageSource.substring(0, imageIndex);
        }
        
        ThumbnailZoomPlus.Pages._logger.debug("Pages.Google.getSpecialSource: before decode URI=" + imageSource);

        // The image URL is double-encoded; for example, a space is represented as "%2520".
        // After first decode it's "%20" and after second decode it's " ".
        imageSource = decodeURIComponent(imageSource);
        ThumbnailZoomPlus.Pages._logger.debug("Pages.Google.getSpecialSource: after decode URI=" + imageSource);

        imageSource = decodeURIComponent(imageSource);
        ThumbnailZoomPlus.Pages._logger.debug("Pages.Google.getSpecialSource: after 2nd decode URI=" + imageSource);
      }
    }
    return imageSource;
  },
  getZoomImage : function(aImageSrc, node, flags) {
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
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/\/default\./);
    let image =
      (rex.test(aImageSrc) ? aImageSrc.replace(rex, "/hqdefault.") : null);
    return image;
  },
  getSpecialSource : function(aNode, aNodeSource) {
    if (-1 == aNodeSource.indexOf("http:") &&
        -1 == aNodeSource.indexOf("https:")) {
      aNodeSource = "http:" + aNodeSource;
    }
    return aNodeSource;
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
    let rex = new RegExp(/\._.+_(\.[a-z]+)/i);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1") : null);
    return image;
  }
};

/**
 * Imgur
 */
ThumbnailZoomPlus.Pages.Imgur = {
  key: "imgur",
  name: "Imgur",
  host: /^(.*\.)?imgur\.com$/,
  imageRegExp: /(i\.)?imgur\.com\//,
  getZoomImage : function(aImageSrc, node, flags) {
    let rex = new RegExp(/(\/[a-z0-9]{5})[bsm](\.[a-z]+)/i);
    let image = (rex.test(aImageSrc) ? aImageSrc.replace(rex, "$1$2") : null);
    return image;
  }
};

/**
 * Photosight
 *
 * ex1:
 * http://s.photosight.ru/img/4/aef/4167500_icon.jpg
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
 */
ThumbnailZoomPlus.Pages.Photosight = {
  key: "photosight",
  name: "Photosight",
  host: /^(.*\.)?photosight\.ru$/i,
  imageRegExp: /\.photosight\.ru/i,
  
  getZoomImage : function(aImageSrc, node, flags) {
    let rex1 = new RegExp(/_(icon)\./);
    let rex2 = new RegExp(/_(crop)_[0-9]+\./);
    let rex3 = new RegExp(/_top_of_day\./);
    let rex4 = new RegExp("//prv-(.*/)pv_([0-9]+\\.)");
    let image = 
      rex1.test(aImageSrc) ? aImageSrc.replace(rex1, "_large.") :
      rex2.test(aImageSrc) ? aImageSrc.replace(rex2, "_large.") :
      rex3.test(aImageSrc) ? aImageSrc.replace(rex3, "_large.") : 
      rex4.test(aImageSrc) ? aImageSrc.replace(rex4, "//img-$1$2") :
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
  name: "", // Set in ENTITYothers.
  host: /.*/,
  
  // imgur.com links w/o image type suffix give page containing image.
  // Allow that; we'll add suffix in getZoomImage.  Also allow youtube links,
  // which getZoomImage will convert to a youtube thumb.
  // Note that we can't support imgur.com/a/ links (albums) since there is no
  // image named similarly to the link.
  
  imageRegExp: new RegExp(ThumbnailZoomPlus.Pages._imageTypesRegExpStr + "([?&].*)?$|" +
                      "tumblr.com/(photo/|tumblr_)|" +
                      "imgur\\.com/(gallery/)?(?!gallery|tools|signin|register|tos$|contact|removalrequest|faq$)" +
                          "[^/&\\?]+(&.*)?$|" +
                      "(?:www\\.(nsfw)?youtube\\.com|youtu.be)/watch.*(?:v=|/)([^&#!/]+)[^/]*/*$|" +
                      "/youtu.be/[^/]+$|" +
                      "quickmeme\\.com/meme/|" +
                      "qkme.me/|" +
                      "/index.php\?.*module=attach|" + // IP.board, eg rootzwiki.com
                      "^(https?://(.*\\.)?twitpic.com/)(?!(upload))([a-z0-9A-Z]+)$|" +
                      "^https?://twitter.com/.*\\?url=([^&]+)(&.*)?$|" +
                      "[\?&]img_?url=|" +
                      "(https?)://(?!(?:www|today|groups|muro|chat|forum|critiques|portfolio|help|browse)\\.)" +
                          "([^/?&.])([^/?&.])([^/?&.]*)\\.deviantart\\.com/?$|" +
                      "stumbleupon.com\/(to|su)\/[^\/]+\/(.*" + ThumbnailZoomPlus.Pages._imageTypesRegExpStr + ")" +
                      "i"),

  _logger: ThumbnailZoomPlus.Pages._logger,
  
  getSpecialSource : function(aNode, aNodeSource) {
    // we never want to use the img node.
    return null;
  },
  
  getImageNode : function(aNode, nodeName, nodeClass) {
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
        let related = imgNode.ownerDocument.getElementById(id);
        this._logger.debug("ThumbnailPreview: Others: related ID=" + id + "; related=" +
                           String(related));
        if (related && related.getAttribute("href") != "") {
            imgNodeURL = related.getAttribute("href");
            aNode = related;
            this._logger.debug("ThumbnailPreview: Others: detected tumblr high-rez link " +
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
        let tumblrOrPhotoRegExp = new RegExp("\\.tumblr\\.com/(photo/|tumblr_).*|(.*" + 
                                    ThumbnailZoomPlus.Pages._imageTypesRegExpStr 
                                    + ")", "i");
        if (// We disallow assets.tumblr.com, e.g. the "dashboard" button.
            ! /assets\.tumblr\.com/.test(imgNodeURL) &&
            // test the link node's URL to see if it's an image:
            (aNode == null || ! tumblrOrPhotoRegExp.test(String(aNode))) ) {
          this._logger.debug("ThumbnailPreview: Others: detected tumblr; using thumb as image, node "
                             + imgNode + " " + imgNodeURL);
          
          return imgNode;
        }
    }
    
    return aNode;
  },
  
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

    // For google images links, images.yandex.ru, and some others, get URL from
    // imgurl=... part.
    let imgurlEx = new RegExp(/.*[\?&]img_?url=([^&]+).*$/);
    if (imgurlEx.test(aImageSrc)) {
      if (! ThumbnailZoomPlus.isNamedPageEnabled(ThumbnailZoomPlus.Pages.Google.key)) {
        return ""; // Google Images support is disabled by user preference.
      }
      aImageSrc = aImageSrc.replace(imgurlEx, "$1");
      if (! /^https?:\/\/./.test(aImageSrc)) {
        aImageSrc = "http://" + aImageSrc;
      }
      aImageSrc = decodeURIComponent(aImageSrc);
    }

    // Deviantart external links: change
    // http://www.deviantart.com/users/outgoing?http://www.youtube.com/watch?v=DLQBAOomHzq to
    // http://www.youtube.com/watch?v=DLQBAOomHzq
    let deviantOutgoingRex = new RegExp("https?://[^\\.]+\\.deviantart\\.com/.*/outgoing\\?(.*)");
    if (deviantOutgoingRex.test(aImageSrc)) {
      if (! ThumbnailZoomPlus.isNamedPageEnabled(ThumbnailZoomPlus.Pages.DeviantART.key)) {
        return ""; // DeviantART support disabled by user preference.
      }
      aImageSrc = aImageSrc.replace(deviantOutgoingRex, "$1");
      this._logger.debug("ThumbnailPreview: after deviantArt outgoing rule: " + aImageSrc);
    }

    // Deviantart profile links:
    // Change link
    // http://truong-abcdef.deviantart.com/ to
    // http://a.deviantart.net/avatars/t/r/truong-san.jpg?1 (/t/r/ are from the 1st 2 letters)
    // We unfortunately have to assume either jpg or gif.
    let deviantProfileRex = new RegExp("(https?)://([^/?&.])([^/?&.])([^/?&.]*)\\.deviantart\\.com/?$");
    if (deviantProfileRex.test(aImageSrc)) {
      if (! ThumbnailZoomPlus.isNamedPageEnabled(ThumbnailZoomPlus.Pages.DeviantART.key)) {
        return ""; // DeviantART support disabled by user preference.
      }
      aImageSrc = aImageSrc.replace(deviantProfileRex, "$1://a.deviantart.net/avatars/$2/$3/$2$3$4.jpg?1");
    }
    
    // For twitter links like https://twitter.com/#!/search/picture/slideshow/photos?url=https%3A%2F%2Fp.twimg.com%2FAe0VPNGCIAIbRXW.jpg
    let twitterEx = new RegExp("^https?://twitter.com/.*\\?url=([^&]+)(&.*)?$");
    if (twitterEx.test(aImageSrc)) {
      if (! ThumbnailZoomPlus.isNamedPageEnabled(ThumbnailZoomPlus.Pages.Twitter.key)) {
        return ""; // Twitter support is disabled by user preference.
      }
      aImageSrc = decodeURIComponent(aImageSrc.replace(twitterEx, "$1"));
    }
    
    // For links to twitpic pages, chage
    // http://twitpic.com/10l4j4.jpg to
    // http://twitpic.com/show/full/10l4j4  (or .../large/...)
    let twitpicEx = new RegExp("^(https?://(.*\\.)?twitpic.com/)([^\\./]+)$");
    if (twitpicEx.test(aImageSrc)) {
      if (! ThumbnailZoomPlus.isNamedPageEnabled(ThumbnailZoomPlus.Pages.Twitpic.key)) {
        return ""; // Twitter support is disabled by user preference.
      }
      aImageSrc = aImageSrc.replace(twitpicEx, "$1/show/full/$3");
    }
    
    // For youtube links, change 
    // http://www.youtube.com/watch?v=-b69G6kVzTc&hd=1&t=30s to 
    // http://i3.ytimg.com/vi/-b69G6kVzTc/hqdefault.jpg
    // http://youtu.be/kuX2lI84YRQ to
    // http://i3.ytimg.com/vi/kuX2lI84YRQ/hqdefault.jpg
    let youtubeEx = new RegExp("(https?://)(?:[^/]*\.)?(?:youtube\\.com|nsfwyoutube\\.com|youtu\\.be).*(?:v=|/)([^?&#!/]+)[^/]*/*$");
    if (youtubeEx.test(aImageSrc)) {
      if (! ThumbnailZoomPlus.isNamedPageEnabled(ThumbnailZoomPlus.Pages.YouTube.key)) {
        return ""; // YouTube support disabled by user preference.
      }
      aImageSrc = aImageSrc.replace(youtubeEx, "$1i3.ytimg.com/vi/$2/hqdefault.jpg");
    }
  
    // For blogger aka Blogspot, change
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s500/DSC_0043.JPG to
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s1600/DSC_0043.JPG; change
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s320-p/Tiara+Riley.jpeg to
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s1600-p/Tiara+Riley.jpeg
    // NOTE: This rule exists in both Others and Thumbnails, and should be the same in both.
    let blogspotRegExp = new RegExp("(\\.(blogspot|blogger)\\.com/.*)/s[0-9]+(-[a-z])?/([^/?&]+\.[^./?&]*)$");
    aImageSrc = aImageSrc.replace(blogspotRegExp, "$1/s1600/$4");

    // If imgur link, remove part after "&" or "#", e.g. for https://imgur.com/nugJJ&yQU0G
    // Also turn http://imgur.com/gallery/24Av1.jpg into http://imgur.com/24Av1.jpg
    let imgurRex = new RegExp(/(imgur\.com\/)(gallery\/)?([^\/&#]+)([&#].*)?/);
    aImageSrc = aImageSrc.replace(imgurRex, "$1$3");

    let quickmemeEx = new RegExp(/(?:www\.quickmeme\.com\/meme|(?:i\.)?qkme\.me)\/([^\/\?]+).*/);
    aImageSrc = aImageSrc.replace(quickmemeEx, "i.qkme.me/$1");
  
    // For sites other than tumblr and twitpic, if there is no image suffix, add .jpg.
    let rex = new RegExp("tumblr\\.com/.*|" + 
                         "twimg[.0-9-]|twitpic\\.com|(" +
                         ThumbnailZoomPlus.Pages._imageTypesRegExpStr + 
                         "(\\?.*)?$)", "i");
    if (! rex.test(aImageSrc)) {
      // add .jpg, e.g. for imgur links, if it doesn't appear anywhere 
      // (including stuff.jpg?more=...)
      aImageSrc += ".jpg";
    }
    this._logger.debug("ThumbnailPreview: Others using zoom image " + aImageSrc);

    return aImageSrc;
  }
};

/**
 * Thumbnail: returns the thumbnail itself as the image source.
 */
ThumbnailZoomPlus.Pages.Thumbnail = {
  key: "thumbnail",
  name: "", // Set in ENTITYthumbnail.
  host: /.*/,
  
  // We basically match any image, but exclude some which are annoying to
  // show.  
  imageRegExp: new RegExp("^(?![^/]*(" +
                          "(//.*\\.google\\.com?[.a-z]*/(.*/)?images/)|" + // google logos
                          "(//[a-z0-9]+\\.google.com?[.a-z]*/.*[/?]lyrs=.*)|" + // google maps tiles
                          "(//maps\\.google\\.com?[.a-z]*/.*)|" + // google maps user photo popups, etc.
                          "(//maps.gstatic.com?[.a-z]*/.*)|" + // google maps button images
                          "(//sh.deviantart.net/shadow/)|" + // deviantart frame around thumbs
                          "((.*\.)(ssl-)?images\-amazon\\.com/images/.*/(buttons|gui)/)|" + // amazon buttons
                          "(^data:image/gif;base64,R0lGODlhEAA)" + // LastPass icon in input fields
                          ")).*", "i"),
    
  getZoomImage : function(aImageSrc, node, flags) {
    let nodeName = node.localName.toLowerCase();
    let nodeClass = node.getAttribute("class");
    ThumbnailZoomPlus.Pages._logger.debug("getZoomImage Thumbnail for " + nodeName 
                                          + " class='" + nodeClass + "'");
    if (! node.hasAttribute("src") && node.hasAttribute("href") &&
        node.style.backgroundImage.indexOf("url") == -1) {
      // We don't want to return aNode if it's just an href since we need
      // it to be an actual image.  (The Others rule already handles hrefs.)
      ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage: ignoring since it's a link, not a thumb");
      return null;
    }

    // For certain sites, if node has a background style, use image from that.
    // And actually, aImageSrc may be already coming from the
    // background but needs to be excluded.
    // But in general we don't since it leads to too many popups from static
    // background styling (non-image) graphics.
    let backImage = node.style.backgroundImage;
    let urlRegExp = /url\(/i;
    if (backImage && "" != backImage && urlRegExp.test(backImage)) {
      if (node.children.length > 0 && ! /thumb/.test(nodeClass)) {
        // Ignore e.g. in Google Offers, where a big map image is the background
        // around the guts of the page.
        // But we explicitly allow using background image if nodeClass
        // contains "thummb", as in 
        ThumbnailZoomPlus.Pages._logger.debug(
            "thumbnail getZoomImage: ignoring background image since has " +
            node.children.length + " children > 0");
        return null;
      }
    }
    
    // Disable for certain kinds of Facebook thumbs.
    ThumbnailZoomPlus.Pages._logger.debug("thumbnail getZoomImage: node=" +
                                          node + "; class=" +
                                          nodeClass);
    if ("spotlight" == nodeClass && /\.(fbcdn|akamaihd)\.net/.test(aImageSrc) // facebook 'lightbox'
        ) {
        ThumbnailZoomPlus.Pages._logger.debug("getZoomImage: ignoring since Facebook spotlight");
      return null;
    }
    if (nodeClass && nodeClass.indexOf("actorPic") >= 0) {
      // Don't show popup for small Facebook thumb of the person who's
      // entering a comment since the comment field loses focus and the 
      // thumbnails disappears, which is confusing.
        ThumbnailZoomPlus.Pages._logger.debug("getZoomImage: ignoring since Facebook actorPic");
      return null;
    }

    // For tiny tumblr profile thumbs change 
    // http://30.media.tumblr.com/avatar_a1aefbaa780f_16.png to
    // http://30.media.tumblr.com/avatar_a1aefbaa780f_128.png
    let tumblrRegExp = /(\.tumblr\.com\/avatar_[a-f0-9]+)_[0-9][0-9]\./;
    aImageSrc = aImageSrc.replace(tumblrRegExp, "$1_128.");

    // For Google Play Android Apps, change
    // https://lh6.ggpht.com/JAPlPOSg988jbSWvtxUjFObCguHOJk1yB1haLgUmFES_r7ZhAZ-c7WQEhC3-Sz9qDT0=h230 to
    // https://lh6.ggpht.com/JAPlPOSg988jbSWvtxUjFObCguHOJk1yB1haLgUmFES_r7ZhAZ-c7WQEhC3-Sz9qDT0
    let googlePlayRegExp = new RegExp("(\\.ggpht\\.com/.*)=h[0-9]+$");
    let aImageSrc = aImageSrc.replace(googlePlayRegExp, "$1");
    
    // For wordpress, change:
    // http://s2.wp.com/imgpress?w=222&url=http%3A%2F%2Fthreehundredsixtysixdaysdotcom.files.wordpress.com%2F2012%2F02%2Fvalentines_me.jpg to
    // http://threehundredsixtysixdaysdotcom.files.wordpress.com/2012/02/valentines_me.jpg
    // and
    // http://s.wordpress.com/imgpress?resize=300,230&url=http%3A%2F%2Fhappywanderer15.files.wordpress.com%2F2012%2F03%2Fitaly-170.jpg to
    // http://s.wordpress.com/imgpress?url=http%3A%2F%2Fhappywanderer15.files.wordpress.com%2F2012%2F03%2Fitaly-170.jpg
    let imgpressEx = new RegExp("^https?://[^/]+\\.(wp|wordpress)\\.com/imgpress(\\?.*)?[?&]url=([^?&]+).*");
    if (imgpressEx.test(aImageSrc)) {
      aImageSrc = aImageSrc.replace(imgpressEx, "$3");
      aImageSrc = decodeURIComponent(aImageSrc);
    }
    
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
    
    // For blogger aka Blogspot, change
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s500/DSC_0043.JPG to
    // http://3.bp.blogspot.com/-3LhFo9B3BFM/T0bAyeF5pFI/AAAAAAAAKMs/pNLJqyZogfw/s1600/DSC_0043.JPG; change
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s320-p/Tiara+Riley.jpeg to
    // http://1.bp.blogspot.com/-cCrMafs3SJ4/TwcFrqD23II/AAAAAAAABCg/3GxEgPh0qRQ/s1600-p/Tiara+Riley.jpeg
    // NOTE: This rule exists in both Others and Thumbnails, and should be the same in both.
    let blogspotRegExp = new RegExp("(\\.(blogspot|blogger)\\.com/.*)/s[0-9]+(-[a-z])?/([^/?&]+\.[^./?&]*)$");
    aImageSrc = aImageSrc.replace(blogspotRegExp, "$1/s1600/$4");
    
    aImageSrc = aImageSrc.replace(/\/free_pictures\/thumbs\//, "/free_pictures/normal/");
    
    // For leBonCoin.fr: image URLs don't contain the site domainname, so instead
    // we verify the site using baseURI.
    let leBonCoinSiteRegExp = new RegExp("\\.leboncoin\\.fr/", "i");
    if (leBonCoinSiteRegExp.test(node.baseURI)) {
      // change
      // http://193.164.197.30/thumbs/171/1716737621.jpg to
      // http://193.164.197.30/images/171/1716737621.jpg
      let leBonCoinRegExp = new RegExp("/thumbs/([0-9]+/[0-9]+" + 
                                       ThumbnailZoomPlus.Pages._imageTypesRegExpStr +
                                       ")");
      aImageSrc = aImageSrc.replace(leBonCoinRegExp, "/images/$1");
    }        
    
    // For some sites where /images/thumb/(digits) changes thumb to full.
    // This really belongs more in the Others rule, but it often wouldn't
    // work since it'd instead follow the <a> link around the image.
    let regEx = new RegExp("(/images)/(thumb|mini)/([0-9]+/[0-9]+/[0-9]+\.)");
    aImageSrc = aImageSrc.replace(regEx, "$1/full/$3");
    
    // For xh*ster.com, change 000/014/111/004_160.jpg to 000/014/111/004_1000.jpg
    let regEx = new RegExp("xh[a-z0-9]*ster.com.*(/[0-9]+/[0-9]+/[0-9]+/[0-9]+)_[0-9]{1,3}(\.[a-z]+)");
    aImageSrc = aImageSrc.replace(regEx, "$1_1000$2");
    
    // Using the thumb itself as source; don't annoy the user with
    // "too small" warnings, which would be quite common.
    flags.noTooSmallWarning = true;

    return aImageSrc; 
  }

};
