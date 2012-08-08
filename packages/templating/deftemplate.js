(function() {

  Meteor._partials = {};

  // XXX Handlebars hooking is janky and gross

  Meteor._hook_handlebars = function () {
    Meteor._hook_handlebars = function(){}; // install the hook only once

    var orig = Handlebars._default_helpers.each;
    Handlebars._default_helpers.each = function (arg, options) {
      if (!(arg instanceof LocalCollection.Cursor))
        return orig.call(this, arg, options);

      return Spark.list(
        arg,
        function (item) {
          return Spark.labelBranch(item._id || null, function () {
            var html = Spark.isolate(_.bind(options.fn, null, item));
            return Spark.setDataContext(item, html);
          });
        },
        function () {
          return options.inverse ?
            Spark.isolate(options.inverse) : '';
        }
      );
    };

    Handlebars._default_helpers.constant = function(options) {
      // XXX
    };
  };


  Meteor._def_template = function (name, raw_func) {
    Meteor._hook_handlebars();

    window.Template = window.Template || {};

    // Define the function assigned to Template.<name>.
    // First argument is Handlebars data, second argument is the
    // branch key, which is calculated by the caller based
    // on which invocation of the partial this is.
    var partial = function (data, branch) {
      return Spark.labelBranch(branch, function () {
        var html = Spark.isolate(function() {
          return raw_func(data, {
            helpers: partial,
            partials: Meteor._partials,
            name: name
          });
        });

        var t = name && Template[name];
        if (t) {
          html = Spark.attachEvents(t.events || {}, html);
          html = Spark.createLandmark(
            { preserve: t.preserve || {} },
            // XXX actually, we need to make this landmark available
            // to Forms and execute the template here.
            function(landmark) { return html; });
        }

        html = Spark.setDataContext(data, html);
        return html;
      });
    };

    // XXX hack.. copy all of Handlebars' built in helpers over to
    // the partial. it would be better to hook helperMissing (or
    // something like that?) so that Template.foo is searched only
    // if it's not a built-in helper.
    _.extend(partial, Handlebars.helpers);


    if (name) {
      if (Template[name])
        throw new Error("There are multiple templates named '" + name +
                        "'. Each template needs a unique name.");

      Template[name] = partial;

      Meteor._partials[name] = partial;
    }

    // useful for unnamed templates, like body
    return partial;
  };

})();
