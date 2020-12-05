//= require turbolinks
//= require jquery

//= require hashicorp/sidebar
//= require hashicorp/analytics

//= require analytics

//= require hashi-stack-menu/main
//= require terraform-overview/vendor-scripts/object-fit-images.min.js
// DON'T require terraform-overview/home-hero, because the compressor is old.
//= require terraform-overview/hashi-tabbed-content


// Be less hurky-jerky when clicking in-same-page anchor links, and just let the
// browser handle it.
document.addEventListener("turbolinks:click", function(e) {
    var here = document.location;
    var dest = new URL(e.data.url);
    if ( here.origin === dest.origin
      && here.pathname === dest.pathname
      && here.search === dest.search )
    {
        // cancel the turbolinks visit. Doesn't affect "real" click event.
        e.preventDefault();
    }
});

// When doing a turbolinks visit, handle all the layout changes BEFORE we allow
// turbolinks to consider itself finished. It calls Element.scrollIntoView() to
// handle anchor links, and the browser handles that scrolling async without any
// way to spy on it; if we're modifying the height of the page WHILE the browser
// is trying to scroll somewhere specific, we clip through the floor and launch
// ourselves out into the skybox. Anyway, by doing this on the new body element
// before turbolinks tries to shim it into place, we're finished long before it
// decides where it's scrolling.
document.addEventListener("turbolinks:before-render", function(e) {
    setUpUIFeatures(e.data.newBody);
});

// Except, the first time we load a page, it's not considered a turbolinks
// visit! So we need to have a special case handler for initial page load.
document.addEventListener("DOMContentLoaded", function(_e) {
    setUpUIFeatures(document.body);
});

// Variables and stuff
var selQuickNav = '#inner-quicknav > ul.dropdown';
var selDocsSidenavs = '#docs-sidebar ul.nav.docs-sidenav';
var sidebarControlsHTML =
    '<div id="sidebar-controls">' +
        '<div id="sidebar-filter" style="display: none;">' +
            '<span class="glyphicon glyphicon-search"></span>' +
            '<label for="sidebar-filter-field" class="sr-only sr-only-focusable">Filter page titles in sidebar navigation</label>' +
            '<input type="search" id="sidebar-filter-field" class="form-control" name="sidebar-filter-field" role="search" placeholder="Filter page titles" />' +
            '<button id="filter-close" class="glyphicon glyphicon-remove-circle" title="Reset filter"><span class="sr-only sr-only-focusable">Reset sidebar filter</span></button>' +
        '</div>' +
        '<div id="sidebar-buttons">' +
            '<button id="toggle-button">Expand all</button>' +
            ' | ' +
            '<button id="filter-button" title="Shortcut: type the / key">Filter</button>' +
        '</div>' +
    '</div>';
var quickNavHTML =
    '<div id="inner-quicknav">' +
        '<span id="inner-quicknav-trigger">' +
            'Jump to Section' +
            '<svg width="9" height="5" xmlns="http://www.w3.org/2000/svg"><path d="M8.811 1.067a.612.612 0 0 0 0-.884.655.655 0 0 0-.908 0L4.5 3.491 1.097.183a.655.655 0 0 0-.909 0 .615.615 0 0 0 0 .884l3.857 3.75a.655.655 0 0 0 .91 0l3.856-3.75z" fill-rule="evenodd"/></svg>' +
        '</span>' +
        '<ul class="dropdown"></ul>' +
    '</div>';

var sidebarController = {
    reset: function() {
        $('#sidebar-filter-field').trigger("blur").val("");
        $(selDocsSidenavs).find("li").show();
        this.expandDefaults();
        $('#toggle-button').html("Expand all");
        $('#sidebar-buttons').show();
        $('#sidebar-filter').hide();
    },
    expandAll: function() {
        this.enableReset();
        $(selDocsSidenavs).find('li').addClass('active');
    },
    expandDefaults: function() {
        var docsSideNavs = $(selDocsSidenavs);
        // Reset everything to inactive. .has-subnav is added during setup.
        docsSideNavs.find('.has-subnav').removeClass("active");
        // Activate current page, locked-open navs, and all their ancestors. (These
        // classes propagate to ancestors during setup.)
        docsSideNavs.find('.current, .nav-visible').addClass('active');
        // Activate auto-expand navs, but leave their ancestors alone:
        docsSideNavs.find('.nav-auto-expand').parent('li').addClass('active');
    },
    enableReset: function() {
        $('#toggle-button').html("Reset");
    },
    showFilter: function() {
        this.enableReset();
        $('#sidebar-buttons').hide();
        $('#sidebar-filter').show();
        $('#sidebar-filter-field').focus();
    },
    // Filter as you type. This alters three things:
    // - "active" class on subnavs
    // - direct show/hide of <li>s
    // - state of #toggle-button
    performFilter: function() {
        var filterRegexp = new RegExp($('#sidebar-filter-field').val(), 'i');
        var sidebarLinks = $(selDocsSidenavs).find('a');
        var matchingLinks = sidebarLinks.filter(function(index) {
            return $(this).text().match(filterRegexp);
        });
        sidebarLinks.parent('li').hide();
        $(selDocsSidenavs).find('li').removeClass('active'); // cleans up partial as-you-type searches
        // make matches and their parents visible and expanded:
        matchingLinks.parents('li').show().addClass('active');
        // make direct children visible (if your search caught a subnav directly):
        matchingLinks.parent('li').find('li').show();
    },
};

// Modify the page layout, and set up terraform.io UI features
function setUpUIFeatures(bodyElement) {
    "use strict";

    // SIDEBAR STUFF:
    // - "subNavs" are <li> elements with a nested <ul> as a direct child.
    // - The <a> child is the "header" of the subnav, and the <ul> is its "content."
    // - Subnavs are collapsed (<ul> hidden) or expanded (<ul> visible).
    // - Collapse/expand is managed by the "active" class on the <li>.

    // Move the header (if any) into the grid container so we can make things line up nicely.
    var sidebarHeaderGrid = $("#sidebar-header-grid", bodyElement);
    var sidebarHeader = $("#docs-sidebar", bodyElement).find("h1,h2,h3,h4,h5,h6").not("#otherdocs").first();
    sidebarHeaderGrid.append(sidebarHeader);

    var docsSideNavs = $(selDocsSidenavs, bodyElement);
    docsSideNavs.find("ul").addClass("nav-hidden");
        // we leave the nav-hidden class alone after this. We just use it so
        // non-JS users aren't left with no way to view the nav.
    // Colored links for current page and its ancestors. The a.current-page
    // class is added during build by layouts/inner.erb.
    docsSideNavs.find("li").has(".current-page").addClass("current");
    // The optional .nav-visible class locks open a section and all of its ancestors.
    docsSideNavs.find('li').has('.nav-visible').addClass('nav-visible');

    // Add toggle controls:
    docsSideNavs.find("li").has("ul").addClass("has-subnav");
    // Activate current page, locked-open navs, and all their ancestors:
    docsSideNavs.find('.current, .nav-visible').addClass('active');
    // Activate auto-expand navs, but leave their ancestors alone:
    docsSideNavs.find('.nav-auto-expand').parent('li').addClass('active');

    // If this is a Very Large Sidebar, add extra controls to expand/collapse
    // and filter it.
    var sidebarLinks = docsSideNavs.find("a");
    if (sidebarLinks.length > 30) {
        if ($("#sidebar-controls", bodyElement).length === 0) { // then add it!
            sidebarHeaderGrid.append(sidebarControlsHTML);
        }
    }

    // Move the main title into the grid container, so we can make things line up nicely.
    var innerHeaderGrid = $('#inner-header-grid', bodyElement);
    innerHeaderGrid.append( $("#inner h1", bodyElement).first() );

    // On docs/content pages, add a hierarchical quick nav menu if there are
    // more than two H2/H3/H4 headers.
    var headers = $('#inner', bodyElement).find('h2, h3, h4');
    if (headers.length > 2 && $("div#inner-quicknav", bodyElement).length === 0) {
        // Build the quick-nav HTML:
        innerHeaderGrid.append(quickNavHTML);
        var quickNav = $(selQuickNav, bodyElement);
        headers.each(function(index, element) {
            var a = document.createElement('a');
            a.setAttribute('href', '#' + element.id);
            a.textContent = element.innerText;

            var li = document.createElement('li');
            li.className = 'level-' + element.nodeName.toLowerCase();
            li.append(a);

            quickNav.append(li);
        });
        // Event listener is on document, outside this setup.
    }

    // Downloads CTA
    var $downloadLinks = $("section.downloads .details a", bodyElement);
    var $learnCtas = $("section.downloads .learn-cta", bodyElement);
    $downloadLinks.on("click", function () {
        var $learnCta = $(this).parents(".download").find(".learn-cta");

        // Terminate early if user is downloading same OS different arch
        if ($learnCta.hasClass("show")) return;

        // When downloading first first time or for an additional OS
        $learnCtas.each(function () {
        $(this).removeClass("show");
        });

        $learnCta.addClass("show");
    });

}

// Misc event handlers that don't need to change on every turbolinks transition,
// and can thus just live forever.
$(document).on('click', function(e) {
    var target = $(e.target);
    var quickNav = $(selQuickNav);

    // SIDEBAR STUFF:
    if ( target.is('.has-subnav') ) {
        // toggle arrow toggles its subnav.
        target.toggleClass('active');
    } else if ( target.is(".has-subnav > a[href^='#']") ) {
        // links that don't go anywhere act as toggle controls.
        e.preventDefault();
        target.parent().toggleClass('active');
    } else if ( target.is('#filter-button') ) {
        sidebarController.showFilter();
    } else if ( target.is('#filter-close') ) {
        sidebarController.reset();
    } else if ( target.is('#toggle-button') ) {
        if ( $('#toggle-button').text() === "Expand all" ) {
            sidebarController.expandAll();
        } else {
            sidebarController.reset();
        }
    }

    // QUICK-NAV STUFF: (not mutually exclusive w/ sidebar stuff, due to the final 'else')
    if (target.closest('#inner-quicknav-trigger').length > 0) {
        // clicking trigger (or its svg child) toggles quick-nav.
        quickNav.toggleClass('active');
    } else if (target.is('#inner-quicknav > ul.dropdown li a')) {
        // Jumping to a section means you're done with quick-nav.
        quickNav.removeClass('active');
    } else if (target.closest(quickNav).length > 0) {
        // clicking inside quick-nav doesn't close it.
        // Do nothing.
    } else {
        // Clicking outside quick-nav closes it.
        quickNav.removeClass('active');
    }
});

$(document).on('keyup', function(e) {
    if ( e.target === document.getElementById('sidebar-filter-field') ) {
        if (e.keyCode === 27) { // escape key
            sidebarController.reset();
        } else {
            sidebarController.performFilter();
        }
    }
});

$(document).on('keydown', function(e) {
    // 191 = / (forward slash) key
    if (e.keyCode !== 191) {
        return;
    }
    var focusedElementType = document.activeElement.tagName;
    if (focusedElementType !== "TEXTAREA" && focusedElementType !== "INPUT") {
        e.preventDefault();
        sidebarController.showFilter();
    }
});
