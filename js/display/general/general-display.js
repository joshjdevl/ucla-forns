/**
 * general-display.js
 * 
 * Javascript-mediated display elements for most site pages
 */
$(function () {
  var scrollspy = $("#scrollspy"),
      presentationMode = false,
      presentationClass = "presentation-display",
      noteMode = false,
      currentNote = 0,
      styleMap = {
        ".question": {
          glyphicon: "glyphicon-question-sign",
          classes: "alert alert-warning"
        },
        ".definition": {
          glyphicon: "glyphicon-info-sign",
          classes: "alert alert-info"
        },
        ".toolkit": {
          glyphicon: "glyphicon-cog",
          classes: "alert alert-info"
        },
        ".example": {
          glyphicon: "glyphicon-check",
          classes: "alert alert-warning"
        },
        ".debug": {
          glyphicon: "glyphicon-warning-sign",
          classes: "alert alert-danger"
        },
        ".answer": {
          glyphicon: "glyphicon-chevron-right",
          classes: "alert alert-success"
        }
      },
      animationTime = 200,
      refreshScrollspy = function () {
        $('[data-spy="scroll"]').each(function () {
          var $spy = $(this).scrollspy('refresh');
        });
      };
  
  // Set up ScrollSpy elements
  $(".scrollspy-element")
    .each(function () {
      scrollspy.append(
        "<li><a href='#" + $(this).attr("id") + "'>" + $(this).attr("scrollspy-title") + "</a></li>"
      );
    });
    
  // Refresh scrollspy
  refreshScrollspy();
  
  // Set up presentation mode
  $(document)
    .on("keypress", function (e) {
      if (e.keyCode === 80) {
        // If we're already in presentation mode, turn it off...
        if (presentationMode) {
          $("." + presentationClass)
            .removeClass(presentationClass);
          $(".presentation-content")
            .addClass("col-md-10")
            .removeClass("presentation-container");
          $("#scrollspy")
            .removeClass("hidden");
        
        // Otherwise, we need to apply presentation mode
        } else {
          // Soooo select all descendants of presentation content
          $(".presentation-content")
            .find("p, pre")
            .addClass(presentationClass);
          $(".presentation-content")
            .removeClass("col-md-10")
            .addClass("presentation-container");
          $("#scrollspy")
            .addClass("hidden");
        }
        presentationMode = !presentationMode;
        setTimeout(function () {
          refreshScrollspy();
        }, animationTime + 100);
      }
    });
  
  // Configure display of the alert elements
  for (var elements in styleMap) {
    $(elements)
      .addClass(styleMap[elements].classes)
      .prepend("<span class='glyphicon " + styleMap[elements].glyphicon + "'></span>&nbsp");
  }
  
  $(".example")
    .prepend("<strong>Example</strong><br/>");
  
  // Questions can be clicked on for the answer
  $(".question")
    .each(function () {
      $(this)
        .click(function () {
          $("[name='" + $(this).attr("name") + "'].answer")
            .fadeIn(animationTime);
        });
    });
  
  /*
   * NOTE TAKING MECHANICS
   */
  
  // Note-taking mode: engage!
  $(document)
    .on("keypress", function (e) {
      if (e.keyCode === 78) {
        // If we're in noteMode, then disable it...
        if (noteMode) {
          $(document).unbind("click");
          $(".presentation-content").removeClass("note-aim");
        
        // ...otherwise, go ahead and turn it on
        } else {
          $(".presentation-content").addClass("note-aim");
          $(document).click(function(event) {
            var target = $(event.target);
            if ($(".presentation-content").find(target).length) {
              target
                .after(
                  "<div id='note-" + currentNote + "' class='alert alert-note'>" +
                    "<a id='note-remove-" + currentNote + "' class='pull-right'>" +
                      "<span class='glyphicon glyphicon-remove'></span>" +
                    "</a>" +
                    "<span class='glyphicon glyphicon-pencil'></span>" +
                    "<strong> Notes</strong><br/><br/>" +
                    "<textarea class='expanding note-textarea' />" +
                  "</div>"
                );
                
              // Event handler for the remove button
              (function (note) {
                $("#note-remove-" + note)
                  .click(function () {
                    $("#note-" + note)
                      .remove();
                  });
              })(currentNote);
                
              // Make the text area stretchy
              $("#note-" + currentNote + " textarea")
                .expandingTextarea();
              currentNote++;
              
              $(document).unbind("click");
              $(".presentation-content").removeClass("note-aim");
            }
          });
        }
      }
    });
});
