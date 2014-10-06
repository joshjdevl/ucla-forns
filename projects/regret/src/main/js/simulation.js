/**
 * simulation.js
 * Simulation of the Multi-armed bandits with observations 
 */


/*
 * =========================================================
 * CLASS DEFINITIONS
 * =========================================================
 */
var getN = function (node) {
      if (typeof(node) === "number") {
        return node;
      }
      return getN(node.children[0]) + getN(node.children[1]);
    },
    
    constructTree = function (vars) {
      if (!vars.length) {
        return 0;
      }
      return {variable: vars[0], children: [constructTree(vars.slice(1)), constructTree(vars.slice(1))]};
    },
    
    Distribution = function (vars) {
      this.vars = vars;
      this.table = constructTree(vars);
      this.count = getN(this.table);
    },
    
    queryCountExec;

Distribution.prototype.addToTree = function (item, node) {
  if (!node) {
    return;
  }
  
  var value, target;
  for (var i in item) {
    if (i === node.variable) {
      value = item[i];
      target = node.children[value];
      break;
    }
  }
  
  // If it's a number, we've reached a leaf
  if (typeof(target) === "number") {
    node.children[value] += 1;
    this.count++;
    return;
  } else {
    this.addToTree(item, target);
  }
};


/*
 * Adds data points to the table / tree in form of:
 * items = [{"X":1, "Y":0}, ...]
 */
Distribution.prototype.addItems = function (items) {
  for (i in items) {
    this.addToTree(items[i], this.table);
  }
};

queryCountExec = function (query, node) {
  if (!node) {
    return 0;
  }
  
  if (typeof(node) === "number") {
    return node;
  }
  
  var value, target;
  for (var q in query) {
    if (q === node.variable) {
      value = query[q];
      target = node.children[value];
      break;
    }
  }
  
  if (typeof(target) !== "undefined") {
    return queryCountExec(query, target);
  }
  return queryCountExec(query, node.children[0]) + queryCountExec(query, node.children[1]);
};

/*
 * Query and evidence will be objects in form: {"X": 1},
 * so for example, P(Y = 1 | X = 1) === dist.getQueryCount([{"Y":1}], [{"X":1}])
 */
Distribution.prototype.query = function (query, evidence) {
  var numerator = query, numCount, eCount;
  
  // First check that we don't have conflicting evidence / query
  for (var e in evidence) {
    for (var q in query) {
      if (e === q && evidence[e] !== query[q]) {
        return 0;
      }
    }
    numerator[e] = evidence[e];
  }

  numCount = queryCountExec(numerator, this.table);
  eCount = queryCountExec(evidence, this.table);
  
  return numCount / eCount;
};



/*
 * Variables must be listed in topological order
 * Structural equations will look like:
 * {
 *   dependencies: ["X", ...], // variables on which the function depends
 *   // NB: params = {"X":0, ...}
 *   eq: function (params) {
 *     // ...
 *   }
 * }
 */
var Simulation = function (vars, structuralEqs) {
      this.vars = vars;
      this.structuralEqs = structuralEqs;
    },
    
    newSampleMap = function (vars) {
      var sample = {};
      for (var v = 0; v < vars.length; v++) {
        sample[vars[v]] = 0;
      }
      return sample;
    };
    
Simulation.prototype.generateSamples = function (n) {
  var samples = [];
  for (var i = 0; i < n; i++) {
    var currentSample = newSampleMap(this.vars);
    for (var v = 0; v < this.vars.length; v++) {
      // Must construct the parameter object for the structural
      // equation
      var params = {},
          currentEqs = this.structuralEqs[v];
      for (var p in currentEqs.dependencies) {
        var currentDep = currentEqs.dependencies[p];
        params[currentDep] = currentSample[currentDep];
      }
      
      // Decide value of current variable in this sample
      // based on its dependencies
      currentSample[this.vars[v]] = this.structuralEqs[v].eq(params);
    }
    // Finally, push that sample onto our return of samples
    samples.push(currentSample);
  }
  return samples;
}


/*
 * Computes the probability of necessity for exposure variable
 * on outcome variable. Parameter examples:
 * exposure: {"X": 0} // Binary assumed, 0 = false, 1 = true
 * outcome: {"Y": 1}, // Samesies
 * obsDist and expDist are loaded Distribution objects
 */
var ProbNecessity = function (exposure, outcome, obsDist, expDist) {
      // We will compute the lower and upper bounds separately,
      // breaking each into its component probability expressions
      var exVar = Object.keys(exposure)[0],
          exVal = exposure[exVar],
          outVar = Object.keys(outcome)[0],
          outVal = outcome[outVar],
          
          // LB
          P_Y_q = {},
          P_Y,
          P_YdoXp_q = {},
          P_YdoXp_e = {},
          P_YdoXp,
          P_XY_q = {},
          P_XY,
          
          // UB
          P_YpdoXp_q = {},
          P_YpdoXp_e = {},
          P_YpdoXp,
          P_XpYp_q = {},
          P_XpYp,
          
          lowerBound = 0,
          upperBound = 0;
          
          
      // Set up query and evidence vars
      P_Y_q[outVar] = outVal;          // P(y)
      P_Y = obsDist.query(P_Y_q, []);
      
      P_YdoXp_q[outVar] = outVal;      // P(y | do(x'))
      P_YdoXp_e[exVar] = 1 - exVal;    // P(y | do(x'))
      P_YdoXp = expDist.query(P_YdoXp_q, P_YdoXp_e);
      
      P_XY_q[outVar] = outVal;         // P(x, y)
      P_XY_q[exVar] = exVal;           // P(x, y)
      P_XY = obsDist.query(P_XY_q, []);
      
      P_YpdoXp_q[outVar] = 1 - outVal; // P(y' | do(x'))
      P_YpdoXp_e[exVar] = 1 - exVal;
      P_YpdoXp = expDist.query(P_YpdoXp_q, P_YpdoXp_e);
      
      P_XpYp_q[exVar] = 1 - exVal;     // P(x', y')
      P_XpYp_q[outVar] = 1 - outVal;
      P_XpYp = obsDist.query(P_XpYp_q, []);
      
      lowerBound = Math.min(1, Math.max(0, (P_Y - P_YdoXp)/P_XY));
      upperBound = Math.max(0, Math.min(1, (P_YpdoXp - P_XpYp)/P_XY));
      
      lowerBound = (isNaN(lowerBound)) ? 0 : lowerBound;
      upperBound = (isNaN(upperBound)) ? 1 : upperBound;
      
      return {lowerBound: lowerBound, upperBound: upperBound};
  },
  
  ProbSufficiency = function (exposure, outcome, obsDist, expDist) {
      // We will compute the lower and upper bounds separately,
      // breaking each into its component probability expressions
      var exVar = Object.keys(exposure)[0],
          exVal = exposure[exVar],
          outVar = Object.keys(outcome)[0],
          outVal = outcome[outVar],
          
          // LB
          P_Y_q = {},
          P_Y,
          P_YdoX_q = {},
          P_YdoX_e = {},
          P_YdoX,
          P_XpYp_q = {},
          P_XpYp,
          
          // UB
          P_XY_q = {},
          P_XY,
          
          lowerBound = 0,
          upperBound = 0;
          
          
      // Set up query and evidence vars
      P_Y_q[outVar] = outVal;          // P(y)
      P_Y = obsDist.query(P_Y_q, []);
      
      P_YdoX_q[outVar] = outVal;       // P(y | do(x))
      P_YdoX_e[exVar] = exVal;    
      P_YdoX = expDist.query(P_YdoX_q, P_YdoX_e);
      
      P_XY_q[outVar] = outVal;         // P(x, y)
      P_XY_q[exVar] = exVal;           
      P_XY = obsDist.query(P_XY_q, []);
      
      P_XpYp_q[exVar] = 1 - exVal;     // P(x', y')
      P_XpYp_q[outVar] = 1 - outVal;
      P_XpYp = obsDist.query(P_XpYp_q, []);
      
      lowerBound = Math.min(1, Math.max(0, (P_YdoX - P_Y)/P_XpYp));
      upperBound = Math.max(0, Math.min(1, (P_YdoX - P_XY)/P_XpYp));
      
      lowerBound = (isNaN(lowerBound)) ? 0 : lowerBound;
      upperBound = (isNaN(upperBound)) ? 1 : upperBound;
      
      return {lowerBound: lowerBound, upperBound: upperBound};
    },
    
    allMax = function (vals) {
      var currentMax = 0;
      for (var v in vals) {
        if (vals[v] > currentMax) {
          currentMax = vals[v];
        }
      }
      return currentMax;
    },
    
    allMin = function (vals) {
      var currentMin = 1;
      for (var v in vals) {
        if (vals[v] < currentMin) {
          currentMin = vals[v];
        }
      }
      return currentMin;
    },
    
    ProbNeccSuff = function (exposure, outcome, obsDist, expDist) {
      // We will compute the lower and upper bounds separately,
      // breaking each into its component probability expressions
      var exVar = Object.keys(exposure)[0],
          exVal = exposure[exVar],
          outVar = Object.keys(outcome)[0],
          outVal = outcome[outVar],
          
          // LB
          P_Y_q = {},
          P_Y,
          P_YdoX_q = {},
          P_YdoX_e = {},
          P_YdoX,
          P_YdoXp_q = {},
          P_YdoXp_e = {},
          P_YdoXp,
          P_YpdoXp_q = {},
          P_YpdoXp_e = {},
          P_YpdoXp,
          
          // UB
          P_XY_q = {},
          P_XY,
          P_XpYp_q = {},
          P_XpYp,
          P_XpY_q = {},
          P_XpY,
          P_XYp_q = {},
          P_XYp,
          
          lowerBound = 0,
          upperBound = 0;
          
          
      // Set up query and evidence vars
      P_Y_q[outVar] = outVal;          // P(y)
      P_Y = obsDist.query(P_Y_q, []);
      
      P_YdoX_q[outVar] = outVal;       // P(y | do(x))
      P_YdoX_e[exVar] = exVal;    
      P_YdoX = expDist.query(P_YdoX_q, P_YdoX_e);
      
      P_YdoXp_q[outVar] = outVal;      // P(y | do(x'))
      P_YdoXp_e[exVar] = 1 - exVal;    
      P_YdoXp = expDist.query(P_YdoXp_q, P_YdoXp_e);
      
      P_YpdoXp_q[outVar] = 1 - outVal; // P(y' | do(x'))
      P_YpdoXp_e[exVar] = 1 - exVal;    
      P_YpdoXp = expDist.query(P_YpdoXp_q, P_YpdoXp_e);
      
      P_XY_q[outVar] = outVal;         // P(x, y)
      P_XY_q[exVar] = exVal;           
      P_XY = obsDist.query(P_XY_q, []);
      
      P_XpY_q[outVar] = outVal;        // P(x', y)
      P_XpY_q[exVar] = 1 - exVal;           
      P_XpY = obsDist.query(P_XpY_q, []);
      
      P_XYp_q[outVar] = 1 - outVal;    // P(x, y')
      P_XYp_q[exVar] = exVal;           
      P_XYp = obsDist.query(P_XYp_q, []);
      
      P_XpYp_q[exVar] = 1 - exVal;     // P(x', y')
      P_XpYp_q[outVar] = 1 - outVal;
      P_XpYp = obsDist.query(P_XpYp_q, []);
      
      lowerBound = Math.min(1, allMax([
        P_YdoX - P_YdoXp,
        P_Y - P_YdoXp,
        P_YdoX - P_Y
      ]));
      upperBound = Math.max(0, allMin([
        P_YdoX,
        P_YpdoXp,
        P_XY + P_XpYp,
        P_YdoX - P_YdoXp + P_XYp + P_XpY
      ]));
      
      lowerBound = (isNaN(lowerBound)) ? 0 : lowerBound;
      upperBound = (isNaN(upperBound)) ? 1 : upperBound;
      
      return {lowerBound: lowerBound, upperBound: upperBound};
    };

/*
 * =========================================================
 * SIMULATION
 * =========================================================
 */

var obsDist_COND_OBS = new Distribution(["X", "Y"]),
    obsDist_COND_COM = new Distribution(["X", "Y"]),
    obsDist_COND_EPS = new Distribution(["X", "Y"]),
    expDist_COND_EXP = new Distribution(["X", "Y"]),
    expDist_COND_COM = new Distribution(["X", "Y"]),
    
    f_Y = function (params) {
      var outcome = Math.random();
      if (params["U"]) {
        return (params["X"]) ? ((outcome < 0.3) ? 1 : 0) : ((outcome < 0.5) ? 1 : 0);
      } else {
        return (params["X"]) ? ((outcome < 0.5) ? 1 : 0) : ((outcome < 0.3) ? 1 : 0);
      }
    },
    
    f_U = function (params) {
      return (Math.random() < 0.5) ? 0 : 1;
    },
    
    f_X_COND_OBS = function (params) {
      return params["U"];
    },
    
    f_X_COND_OBS = function (params) {
      return params["U"];
    },
    
    f_X_COND_EXP = function (params) {
      return (Math.random() < 0.5) ? 0 : 1;
    },
    
    // Flag for whether the decision was an act or an action
    COND_COM_exp_act = false,
    
    // Decides exploration tendency
    EPSILON = 0.15,
    time = 1,
    f_X_COND_COM = function (params) {
      // Here, X will be chosen based on the PN and PS lower bounds
      
      // The original choice is what the agent would have chosen
      // by Nature's system
      var originalChoice = params["U"],
          
          // We'll assess whether or not that original choice should
          // be kept!
          pOrig = obsDist_COND_COM.query({"Y":1}, []);
          pAlt = expDist_COND_COM.query({"Y":1}, {"X": 1 - originalChoice});
          PN0 = ProbNecessity({"X": originalChoice}, {"Y": 1}, obsDist_COND_COM, expDist_COND_COM),
          PN1 = ProbNecessity({"X": 1 - originalChoice}, {"Y": 1}, obsDist_COND_COM, expDist_COND_COM),
          PS0 = ProbSufficiency({"X": originalChoice}, {"Y": 1}, obsDist_COND_COM, expDist_COND_COM),
          PS1 = ProbSufficiency({"X": 1 - originalChoice}, {"Y": 1}, obsDist_COND_COM, expDist_COND_COM),
          PNS0 = ProbNeccSuff({"X": originalChoice}, {"Y": 1}, obsDist_COND_COM, expDist_COND_COM),
          PNS1 = ProbNeccSuff({"X": 1 - originalChoice}, {"Y": 1}, obsDist_COND_COM, expDist_COND_COM);
          
      // We'll weight early trials by exploring, and later ones with
      // exploitation
      if (Math.random() < EPSILON) {
        COND_COM_exp_act = true;
        return (Math.random() < 0.5) ? 0 : 1;
        
      // Here we're exploiting by examining 
      } else {
        if ((pOrig - pAlt) > 0) {
          COND_COM_exp_act = true;
          return originalChoice;
          
        } else {
          COND_COM_exp_act = true;
          return 1 - originalChoice;
        }
      }
    },
    
    f_X_COND_EPS = function (params) {
      // Here, X will be chosen based on the epsilon-greedy
      // algorithm
      
      // Explore with probability epsilon
      if (Math.random() < EPSILON) {
        return (Math.random() < 0.5) ? 0 : 1;
        
      // Here we're exploiting by choosing the current best
      } else {
        return (obsDist_COND_EPS.query({"Y":1}, {"X":0}) > obsDist_COND_EPS.query({"Y":1}, {"X":1})) ? 0 : 1;
      }
    },
    
    sim_orig = new Simulation(
      // Variables:
      ["U", "X", "Y"],
      
      // Structural Eqs:
      [
        // f_U
        {
          dependencies: [],
          eq: f_U
        },
        
        // f_X = U
        {
          dependencies: ["U"],
          eq: f_X_COND_OBS
        },
        
        // f_Y = XOR(U, X)
        {
          dependencies: ["U", "X"],
          eq: f_Y
        }
      ]
    ),
    
    sim = new Simulation(
      // Variables:
      ["U", "X", "Y"],
      
      // Structural Eqs:
      [
        // f_U
        {
          dependencies: [],
          eq: f_U
        },
        
        // f_X = U
        {
          dependencies: ["U"],
          eq: f_X_COND_OBS
        },
        
        // f_Y = XOR(U, X)
        {
          dependencies: ["U", "X"],
          eq: f_Y
        }
      ]
    ),
    
    expSim = new Simulation(
      // Variables:
      ["U", "X", "Y"],
      
      // Structural Eqs:
      [
        // f_U
        {
          dependencies: [],
          eq: f_U
        },
        
        // f_X
        {
          dependencies: [],
          eq: f_X_COND_EXP
        },
        
        // f_Y = XOR(U, X)
        {
          dependencies: ["U", "X"],
          eq: f_Y
        }
      ]
    ),
    
    epsSim = new Simulation(
      // Variables:
      ["U", "X", "Y"],
      
      // Structural Eqs:
      [
        // f_U
        {
          dependencies: [],
          eq: function () {return 0;}
        },
        
        // f_X
        {
          dependencies: [],
          eq: f_X_COND_EPS
        },
        
        // f_Y = XOR(U, X)
        {
          dependencies: ["U", "X"],
          eq: f_Y
        }
      ]
    ),
    
    combinedSim = new Simulation(
      // Variables:
      ["U", "X", "Y"],
      
      // Structural Eqs:
      [
        // f_U
        {
          dependencies: [],
          eq: function () {return 0;}
        },
        
        // f_X
        {
          dependencies: ["U"],
          eq: f_X_COND_COM
        },
        
        // f_Y = XOR(U, X)
        {
          dependencies: ["U", "X"],
          eq: f_Y
        }
      ]
    ),
    
    // Number of trials to run
    T = 1000,
    TESTS = 20,
    
    samples,
    
    LRwinsObs = 0,
    winsObs = 0,
    recordObs = [],
    LRwinsExp = 0,
    winsExp = 0,
    recordExp = [],
    LRwinsEps = 0,
    winsEps = 0,
    recordEps = [],
    LRwinsCom = 0,
    winsCom = 0,
    recordCombined = [];
    
/*
 * =========================================================
 * BANDITS EXPERIMENT
 * =========================================================
 */

// TODO: Simulation is wrong:
// - Combined algorithm logs both observational and
//   experimental at each step, though it chooses only one
// - Issue of not just using observational distribution at the
//   get-go for forward decision-making

for (var tests = 0; tests < TESTS; tests++) {
  obsDist_COND_OBS = new Distribution(["X", "Y"]);
  obsDist_COND_COM = new Distribution(["X", "Y"]);
  obsDist_COND_EPS = new Distribution(["X", "Y"]);
  expDist_COND_EXP = new Distribution(["X", "Y"]);
  expDist_COND_COM = new Distribution(["X", "Y"]);
  samples = sim.generateSamples(T);
  obsDist_COND_OBS.addItems(samples);
  obsDist_COND_COM.addItems(samples);
  
  for (var t = 0; t < T; t++) {
    var obsOutcome = sim.generateSamples(1)[0],
        expOutcome = expSim.generateSamples(1)[0],
        epsOutcome = epsSim.generateSamples(1)[0],
        comOutcome = combinedSim.generateSamples(1)[0];
        
    recordObs.push(obsOutcome["Y"]);
    winsObs += obsOutcome["Y"];
    recordExp.push(expOutcome["Y"]);
    winsExp += expOutcome["Y"];
    recordEps.push(epsOutcome["Y"]);
    winsEps += epsOutcome["Y"];
    recordCombined.push(comOutcome["Y"]);
    winsCom += comOutcome["Y"];
    
    obsDist_COND_OBS.addItems([obsOutcome]);
    expDist_COND_EXP.addItems([expOutcome]);
    obsDist_COND_EPS.addItems([epsOutcome]);
    
    // We'll only update the experimental distribution in cases
    // where the agent did not operate according to nature
    if (COND_COM_exp_act) {
      expDist_COND_COM.addItems([comOutcome]);
    }
    obsDist_COND_COM.addItems([comOutcome]);
    
    time++;
  }
  
  LRwinsObs += winsObs;
  winsObs = 0;
  LRwinsExp += winsExp;
  winsExp = 0;
  LRwinsEps += winsEps;
  winsEps = 0;
  LRwinsCom += winsCom;
  winsCom = 0;
  time = 1;
}

console.log("STATS   ===========================");
console.log("PN:");
console.log(ProbNecessity({"X":1}, {"Y":1}, obsDist_COND_COM, expDist_COND_COM));
console.log(ProbNecessity({"X":0}, {"Y":1}, obsDist_COND_COM, expDist_COND_COM));
console.log("PS:");
console.log(ProbSufficiency({"X":1}, {"Y":1}, obsDist_COND_COM, expDist_COND_COM));
console.log(ProbSufficiency({"X":0}, {"Y":1}, obsDist_COND_COM, expDist_COND_COM));
console.log("PNS:");
console.log(ProbNeccSuff({"X":1}, {"Y":1}, obsDist_COND_COM, expDist_COND_COM));
console.log();

console.log("RESULTS ===========================");
console.log("OBSERVATIONAL:");
console.log(winsObs);
console.log();
console.log("EXPERIMENTAL:");
console.log(winsExp);
console.log();
console.log("EPSILON-GREEDY:");
console.log(winsEps);
console.log();
console.log("COMBINED:");
console.log(winsCom);
console.log();

console.log("LR RES ============================");
console.log("OBSERVATIONAL:");
console.log(parseFloat(LRwinsObs) / TESTS);
console.log();
console.log("EXPERIMENTAL:");
console.log(parseFloat(LRwinsExp) / TESTS);
console.log();
console.log("EPSILON-GREEDY:");
console.log(parseFloat(LRwinsEps) / TESTS);
console.log();
console.log("COMBINED:");
console.log(parseFloat(LRwinsCom) / TESTS);
console.log();