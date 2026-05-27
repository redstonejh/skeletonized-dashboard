(() => {
  const DEMO_NOW = "2026-05-26T12:00:00.000Z";
  const DAY_MS = 86_400_000;

  const cloneJson = (value) => JSON.parse(JSON.stringify(value));

  const hashSeed = (seed = "dashboard-demo") => {
    const text = String(seed || "dashboard-demo");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const seededRandom = (seed = "dashboard-demo") => {
    let state = hashSeed(seed) || 1;
    return () => {
      state = Math.imul(1664525, state) + 1013904223;
      return (state >>> 0) / 4294967296;
    };
  };

  const pick = (random, values) => values[Math.floor(random() * values.length) % values.length];
  const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));
  const isoDate = (base, offsetDays) => {
    const date = new Date(base);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  };
  const isoTimestamp = (base, offsetDays, hour = 12) => {
    const date = new Date(base);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    date.setUTCHours(hour, 0, 0, 0);
    return date.toISOString();
  };

  const fieldType = (value) => {
    if (value == null) return "unknown";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (Array.isArray(value) || typeof value === "object") return "json";
    if (/^\d{4}-\d{2}-\d{2}/.test(String(value)) || /T\d{2}:\d{2}:\d{2}/.test(String(value))) return "date";
    return "string";
  };

  const schemaForRows = (rows = []) => {
    const fields = new Map();
    rows.slice(0, 100).forEach((row) => {
      Object.entries(row || {}).forEach(([name, value]) => {
        const current = fields.get(name) || { name, type: "unknown", nullable: false, sampleValues: [] };
        const nextType = current.type === "unknown" && value != null ? fieldType(value) : current.type;
        if (value == null) current.nullable = true;
        if (value != null && current.sampleValues.length < 4 && !current.sampleValues.includes(value)) {
          current.sampleValues.push(value);
        }
        fields.set(name, { ...current, type: nextType });
      });
    });
    return { fields: [...fields.values()] };
  };

  const semanticMappingFor = (datasetKind = "operations") => {
    const common = {
      dateField: "timestamp",
      valueField: "value",
      labelField: "label",
      categoryField: "category",
      statusField: "status",
      ownerField: "owner",
      locationField: "location",
      latitudeField: "latitude",
      longitudeField: "longitude",
      custom: {
        revenueField: "revenue",
        costField: "cost",
        progressField: "progress",
        thresholdField: "threshold",
        staleField: "lastUpdated",
      },
    };
    if (datasetKind === "financials") return { ...common, valueField: "revenue", categoryField: "segment" };
    if (datasetKind === "inventory") return { ...common, valueField: "quantity", categoryField: "partType" };
    if (datasetKind === "sensorReadings") return { ...common, valueField: "reading", categoryField: "metric" };
    if (datasetKind === "tickets") return { ...common, valueField: "ageHours", categoryField: "queue" };
    return common;
  };

  const generateOperationalData = (options = {}) => {
    const seed = options.seed || "dashboard-demo";
    const random = seededRandom(seed);
    const baseDate = new Date(options.baseDate || DEMO_NOW);
    const statuses = ["Normal", "Positive", "Warning", "Negative", "Stale", "Open", "Closed"];
    const categories = ["North", "East", "South", "West", "Central"];
    const segments = ["Core", "Growth", "Renewal", "Trial"];
    const siteNames = ["Harbor", "Summit", "Ridge", "Valley", "Metro", "Lake", "Cedar", "Quartz"];
    const technicianNames = ["Avery", "Blair", "Casey", "Devon", "Emery", "Finley", "Gray", "Harper"];
    const assetKinds = ["Pump", "Relay", "Panel", "Gateway", "Cooler", "Lift"];
    const workTypes = ["Inspection", "Repair", "Calibration", "Install", "Audit"];
    const queues = ["Intake", "Field", "Review", "Billing", "Planning"];

    const sites = Array.from({ length: 18 }, (_, index) => {
      const category = categories[index % categories.length];
      const latitude = 36.95 + (random() * 1.35);
      const longitude = -123.05 + (random() * 1.85);
      const status = index % 9 === 0 ? "Stale" : index % 7 === 0 ? "Warning" : index % 5 === 0 ? "Negative" : "Normal";
      return {
        id: `site-${String(index + 1).padStart(3, "0")}`,
        label: `${siteNames[index % siteNames.length]} ${index + 1}`,
        category,
        status,
        owner: technicianNames[index % technicianNames.length],
        location: `${siteNames[index % siteNames.length]} Point`,
        latitude: round(latitude, 5),
        longitude: round(longitude, 5),
        value: Math.round(60 + random() * 55),
        progress: round(0.35 + random() * 0.62, 2),
        threshold: 75,
        lastUpdated: isoTimestamp(baseDate, -index % 14, 8 + (index % 8)),
      };
    });

    const customers = Array.from({ length: 26 }, (_, index) => {
      const revenue = Math.round(1200 + random() * 44_000);
      const cost = Math.round(revenue * (0.42 + random() * 0.38));
      const completed = Math.round(6 + random() * 34);
      const total = completed + Math.round(random() * 9);
      return {
        id: `customer-${String(index + 1).padStart(3, "0")}`,
        label: `Account ${String.fromCharCode(65 + (index % 26))}`,
        segment: segments[index % segments.length],
        category: categories[index % categories.length],
        status: index % 11 === 0 ? "Warning" : index % 8 === 0 ? "Stale" : "Positive",
        revenue,
        cost,
        value: revenue,
        comparison: cost,
        progress: round(completed / Math.max(1, total), 2),
        completed,
        total,
        timestamp: isoDate(baseDate, -index),
        owner: technicianNames[(index + 2) % technicianNames.length],
      };
    });

    const technicians = technicianNames.map((name, index) => ({
      id: `tech-${String(index + 1).padStart(2, "0")}`,
      label: name,
      category: ["Field", "Remote", "Planning"][index % 3],
      status: index % 5 === 0 ? "Warning" : "Normal",
      owner: "Dispatch",
      location: sites[index % sites.length].location,
      latitude: round(sites[index % sites.length].latitude + ((random() - 0.5) * 0.08), 5),
      longitude: round(sites[index % sites.length].longitude + ((random() - 0.5) * 0.08), 5),
      value: Math.round(3 + random() * 8),
      progress: round(0.4 + random() * 0.55, 2),
      timestamp: isoTimestamp(baseDate, -index, 9),
    }));

    const assets = Array.from({ length: 42 }, (_, index) => {
      const site = sites[index % sites.length];
      const health = Math.round(35 + random() * 64);
      return {
        id: `asset-${String(index + 1).padStart(4, "0")}`,
        label: `${assetKinds[index % assetKinds.length]} ${index + 1}`,
        category: assetKinds[index % assetKinds.length],
        status: health < 45 ? "Warning" : index % 13 === 0 ? "Stale" : "Normal",
        siteId: site.id,
        location: site.location,
        latitude: site.latitude,
        longitude: site.longitude,
        owner: technicianNames[index % technicianNames.length],
        value: health,
        threshold: 50,
        timestamp: isoDate(baseDate, -(index % 21)),
        lastUpdated: isoTimestamp(baseDate, -(index % 18), 7),
      };
    });

    const workOrders = Array.from({ length: 64 }, (_, index) => {
      const site = sites[index % sites.length];
      const completed = index % 4 === 0;
      const ageHours = Math.round(random() * 180);
      return {
        id: `work-${String(index + 1).padStart(4, "0")}`,
        label: `${workTypes[index % workTypes.length]} ${index + 1}`,
        category: workTypes[index % workTypes.length],
        status: completed ? "Closed" : ageHours > 120 ? "Warning" : "Open",
        owner: technicianNames[(index + 1) % technicianNames.length],
        siteId: site.id,
        location: site.location,
        latitude: site.latitude,
        longitude: site.longitude,
        value: ageHours,
        ageHours,
        progress: completed ? 1 : round(random() * 0.82, 2),
        timestamp: isoTimestamp(baseDate, -(index % 30), 6 + (index % 12)),
        lastUpdated: isoTimestamp(baseDate, -(index % 9), 6 + (index % 10)),
      };
    });

    const events = Array.from({ length: 72 }, (_, index) => {
      const site = sites[index % sites.length];
      const value = Math.round((random() * 120) - (index % 17 === 0 ? 45 : 0));
      return {
        id: `event-${String(index + 1).padStart(4, "0")}`,
        label: `Event ${index + 1}`,
        category: ["Signal", "Process", "Quality", "Capacity"][index % 4],
        status: value < 0 ? "Negative" : value > 95 ? "Warning" : "Normal",
        owner: site.owner,
        siteId: site.id,
        location: site.location,
        latitude: site.latitude,
        longitude: site.longitude,
        value,
        comparison: Math.round(35 + random() * 65),
        timestamp: isoTimestamp(baseDate, -(index % 18), index % 24),
        lastUpdated: isoTimestamp(baseDate, -(index % 18), index % 24),
      };
    });

    const sensorReadings = Array.from({ length: 168 }, (_, index) => {
      const site = sites[index % sites.length];
      const metric = ["Temperature", "Pressure", "Flow", "Battery"][index % 4];
      const baseline = metric === "Temperature" ? 68 : metric === "Pressure" ? 42 : metric === "Flow" ? 120 : 87;
      const reading = round(baseline + ((random() - 0.45) * baseline * 0.42) + (index % 41 === 0 ? baseline * 0.7 : 0), 2);
      return {
        id: `reading-${String(index + 1).padStart(5, "0")}`,
        label: `${metric} ${site.label}`,
        metric,
        category: site.category,
        status: reading > baseline * 1.35 ? "Warning" : index % 53 === 0 ? "Stale" : "Normal",
        siteId: site.id,
        location: site.location,
        latitude: site.latitude,
        longitude: site.longitude,
        owner: site.owner,
        reading,
        value: reading,
        threshold: round(baseline * 1.3, 2),
        timestamp: isoTimestamp(baseDate, -Math.floor(index / 24), index % 24),
        lastUpdated: isoTimestamp(baseDate, -Math.floor(index / 24), index % 24),
      };
    });

    const financials = Array.from({ length: 36 }, (_, index) => {
      const revenue = Math.round(28_000 + random() * 140_000);
      const cost = Math.round(revenue * (0.38 + random() * 0.34));
      return {
        id: `fin-${String(index + 1).padStart(3, "0")}`,
        label: `Period ${index + 1}`,
        segment: segments[index % segments.length],
        category: categories[index % categories.length],
        status: revenue - cost < 16_000 ? "Warning" : "Positive",
        revenue,
        cost,
        value: revenue,
        comparison: cost,
        progress: round((revenue - cost) / Math.max(1, revenue), 2),
        timestamp: isoDate(baseDate, -(35 - index)),
        owner: "Finance",
      };
    });

    const inventory = Array.from({ length: 34 }, (_, index) => {
      const quantity = Math.round(random() * 130) - (index % 16 === 0 ? 12 : 0);
      return {
        id: `part-${String(index + 1).padStart(4, "0")}`,
        label: `Part ${index + 1}`,
        partType: ["Sensor", "Valve", "Cable", "Board", "Fastener"][index % 5],
        category: categories[index % categories.length],
        status: quantity <= 0 ? "Negative" : quantity < 18 ? "Warning" : "Normal",
        quantity,
        reorderPoint: 18,
        value: quantity,
        comparison: 18,
        owner: "Inventory",
        location: sites[index % sites.length].location,
        timestamp: isoDate(baseDate, -(index % 12)),
      };
    });

    const tickets = Array.from({ length: 48 }, (_, index) => {
      const ageHours = Math.round(random() * 220);
      return {
        id: `ticket-${String(index + 1).padStart(4, "0")}`,
        label: `Request ${index + 1}`,
        queue: queues[index % queues.length],
        category: queues[index % queues.length],
        status: ageHours > 144 ? "Warning" : index % 6 === 0 ? "Open" : "Normal",
        ageHours,
        value: ageHours,
        threshold: 96,
        owner: technicianNames[index % technicianNames.length],
        timestamp: isoTimestamp(baseDate, -(index % 20), 10),
      };
    });

    const inspections = Array.from({ length: 30 }, (_, index) => ({
      id: `inspection-${String(index + 1).padStart(3, "0")}`,
      label: `Inspection ${index + 1}`,
      category: ["Scheduled", "Follow-up", "Quality"][index % 3],
      status: index % 10 === 0 ? "Warning" : "Normal",
      value: Math.round(55 + random() * 44),
      progress: round(0.2 + random() * 0.78, 2),
      owner: technicianNames[(index + 3) % technicianNames.length],
      location: sites[index % sites.length].location,
      latitude: sites[index % sites.length].latitude,
      longitude: sites[index % sites.length].longitude,
      timestamp: isoDate(baseDate, index - 8),
    }));

    const projects = Array.from({ length: 16 }, (_, index) => {
      const completed = Math.round(4 + random() * 18);
      const total = completed + Math.round(2 + random() * 9);
      return {
        id: `project-${String(index + 1).padStart(3, "0")}`,
        label: `Project ${index + 1}`,
        category: ["Planning", "Build", "Review", "Launch"][index % 4],
        status: completed / total < 0.45 ? "Warning" : "Normal",
        completed,
        total,
        value: completed,
        comparison: total,
        progress: round(completed / Math.max(1, total), 2),
        owner: technicianNames[index % technicianNames.length],
        timestamp: isoDate(baseDate, -(index % 28)),
      };
    });

    const operations = [
      ...sites,
      ...customers,
      ...assets,
      ...workOrders,
      ...events,
      ...sensorReadings.slice(0, 72),
      ...financials,
      ...inventory,
      ...tickets,
      ...inspections,
      ...projects,
    ].map((row, index) => ({
      ...row,
      recordIndex: index + 1,
      sourceType: row.id?.split("-")[0] || "record",
    }));

    return {
      seed,
      generatedAt: DEMO_NOW,
      datasets: {
        operations,
        customers,
        sites,
        technicians,
        workOrders,
        events,
        assets,
        inspections,
        sensorReadings,
        financials,
        inventory,
        tickets,
        projects,
        emptySubset: [],
      },
      statuses,
      categories,
    };
  };

  const tokenize = (expression = "") => {
    const tokens = [];
    const text = String(expression || "");
    let index = 0;
    while (index < text.length) {
      const char = text[index];
      if (/\s/.test(char)) {
        index += 1;
        continue;
      }
      const two = text.slice(index, index + 2);
      if ([">=", "<=", "==", "!=", "&&", "||"].includes(two)) {
        tokens.push({ type: "operator", value: two });
        index += 2;
        continue;
      }
      if ("+-*/%()!,<>=".includes(char)) {
        tokens.push({ type: char === "(" || char === ")" || char === "," ? "punct" : "operator", value: char });
        index += 1;
        continue;
      }
      if (char === '"' || char === "'") {
        const quote = char;
        let value = "";
        index += 1;
        while (index < text.length && text[index] !== quote) {
          value += text[index];
          index += 1;
        }
        index += 1;
        tokens.push({ type: "literal", value });
        continue;
      }
      const numberMatch = text.slice(index).match(/^\d+(?:\.\d+)?/);
      if (numberMatch) {
        tokens.push({ type: "literal", value: Number(numberMatch[0]) });
        index += numberMatch[0].length;
        continue;
      }
      const idMatch = text.slice(index).match(/^[A-Za-z_][A-Za-z0-9_.]*/);
      if (idMatch) {
        tokens.push({ type: "identifier", value: idMatch[0] });
        index += idMatch[0].length;
        continue;
      }
      throw new Error(`Unsupported expression token near "${text.slice(index, index + 8)}"`);
    }
    return tokens;
  };

  const valueForPath = (row, path, env = {}) => {
    if (path === "true") return true;
    if (path === "false") return false;
    if (path === "null") return null;
    if (path === "now") return Date.parse(env.now || DEMO_NOW);
    const source = path.startsWith("context.") ? env.context : row;
    const clean = path.replace(/^row\./, "").replace(/^context\./, "");
    return clean.split(".").reduce((value, key) => value?.[key], source);
  };

  const numeric = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value ?? "").replace(/[$,%\s,]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const compare = (left, operator, right) => {
    if ([">", ">=", "<", "<="].includes(operator)) {
      const leftNumber = numeric(left);
      const rightNumber = numeric(right);
      if (operator === ">") return leftNumber > rightNumber;
      if (operator === ">=") return leftNumber >= rightNumber;
      if (operator === "<") return leftNumber < rightNumber;
      return leftNumber <= rightNumber;
    }
    if (operator === "!=") return left !== right && String(left) !== String(right);
    return left === right || String(left) === String(right);
  };

  const aggregateRows = (rows, field, aggregation = "count") => {
    if (aggregation === "count") return rows.length;
    const values = rows.map((row) => numeric(row?.[field])).filter(Number.isFinite);
    if (!values.length) return 0;
    if (aggregation === "sum") return round(values.reduce((sum, value) => sum + value, 0), 2);
    if (aggregation === "avg" || aggregation === "average") return round(values.reduce((sum, value) => sum + value, 0) / values.length, 2);
    if (aggregation === "min") return Math.min(...values);
    if (aggregation === "max") return Math.max(...values);
    return values[0] ?? 0;
  };
  const expressionFromTokens = (tokens = []) => tokens.map((token) => (
    token.type === "literal" && typeof token.value === "string"
      ? JSON.stringify(token.value)
      : String(token.value)
  )).join(" ");

  const evaluateExpression = (expression, row = {}, env = {}) => {
    const tokens = tokenize(expression);
    let cursor = 0;
    const peek = () => tokens[cursor];
    const take = (value = null) => {
      const token = tokens[cursor];
      if (value != null && token?.value !== value) throw new Error(`Expected ${value}`);
      cursor += 1;
      return token;
    };
    const parsePrimary = () => {
      const token = peek();
      if (!token) throw new Error("Unexpected end of expression");
      if (token.type === "literal") return take().value;
      if (token.value === "(") {
        take("(");
        const value = parseOr();
        take(")");
        return value;
      }
      if (token.value === "!") {
        take("!");
        return !parsePrimary();
      }
      if (token.value === "-") {
        take("-");
        return -numeric(parsePrimary());
      }
      if (token.type === "identifier") {
        const name = take().value;
        if (peek()?.value === "(") {
          take("(");
          if (["sum", "avg", "average", "min", "max", "count"].includes(name)) {
            const inner = [];
            let depth = 0;
            while (peek() && (depth > 0 || peek().value !== ")")) {
              const next = take();
              if (next.value === "(") depth += 1;
              if (next.value === ")") depth -= 1;
              inner.push(next);
            }
            take(")");
            if (inner.length === 1 && inner[0].type === "identifier") {
              return aggregateRows(env.rows || [], inner[0].value, name);
            }
            if (name === "count") {
              const expressionText = expressionFromTokens(inner);
              return (env.rows || []).filter((entry) => Boolean(evaluateExpression(expressionText, entry, env))).length;
            }
            throw new Error(`${name} requires a field name`);
          }
          const args = [];
          while (peek() && peek().value !== ")") {
            args.push(parseOr());
            if (peek()?.value === ",") take(",");
          }
          take(")");
          if (name === "now") return Date.parse(env.now || DEMO_NOW);
          if (name === "abs") return Math.abs(numeric(args[0]));
          if (name === "round") return Math.round(numeric(args[0]));
          if (name === "floor") return Math.floor(numeric(args[0]));
          if (name === "ceil") return Math.ceil(numeric(args[0]));
          if (name === "coalesce") return args.find((value) => value != null && value !== "") ?? null;
          if (["sum", "avg", "average", "min", "max", "count"].includes(name)) return aggregateRows(env.rows || [], "", name);
          if (name === "daysSince") return round((Date.parse(env.now || DEMO_NOW) - Date.parse(args[0])) / DAY_MS, 2);
          if (name === "hoursSince") return round((Date.parse(env.now || DEMO_NOW) - Date.parse(args[0])) / 3_600_000, 2);
          throw new Error(`Unsupported function ${name}`);
        }
        return valueForPath(row, name, env);
      }
      throw new Error(`Unexpected token ${token.value}`);
    };
    const parseMul = () => {
      let value = parsePrimary();
      while (["*", "/", "%"].includes(peek()?.value)) {
        const operator = take().value;
        const right = parsePrimary();
        if (operator === "*") value = numeric(value) * numeric(right);
        else if (operator === "/") value = numeric(right) === 0 ? null : numeric(value) / numeric(right);
        else value = numeric(value) % numeric(right);
      }
      return value;
    };
    const parseAdd = () => {
      let value = parseMul();
      while (["+", "-"].includes(peek()?.value)) {
        const operator = take().value;
        const right = parseMul();
        value = operator === "+" ? numeric(value) + numeric(right) : numeric(value) - numeric(right);
      }
      return value;
    };
    const parseCompare = () => {
      let value = parseAdd();
      while ([">", ">=", "<", "<=", "==", "!=", "="].includes(peek()?.value)) {
        const operator = take().value;
        value = compare(value, operator, parseAdd());
      }
      return value;
    };
    const parseAnd = () => {
      let value = parseCompare();
      while (peek()?.value === "&&") {
        take("&&");
        value = Boolean(value) && Boolean(parseCompare());
      }
      return value;
    };
    const parseOr = () => {
      let value = parseAnd();
      while (peek()?.value === "||") {
        take("||");
        value = Boolean(value) || Boolean(parseAnd());
      }
      return value;
    };
    const result = parseOr();
    if (cursor < tokens.length) throw new Error(`Unexpected token ${tokens[cursor].value}`);
    return typeof result === "number" ? round(result, 4) : result;
  };

  const applyFilters = (rows, filters = [], context = {}) => rows.filter((row) => filters.every((filter) => {
    if (!filter) return true;
    if (filter.expression) return Boolean(evaluateExpression(filter.expression, row, { ...context, rows }));
    const field = filter.field || filter.key;
    if (!field) return true;
    const operator = filter.operator || "eq";
    const actual = row?.[field];
    const expected = filter.value;
    if (operator === "neq") return actual !== expected;
    if (operator === "contains") return String(actual ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    if (operator === "in") return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
    if (operator === "gte") return numeric(actual) >= numeric(expected);
    if (operator === "lte") return numeric(actual) <= numeric(expected);
    if (operator === "gt") return numeric(actual) > numeric(expected);
    if (operator === "lt") return numeric(actual) < numeric(expected);
    return actual === expected;
  }));

  const applyTimeRange = (rows, timeRange, mapping = {}) => {
    if (!timeRange?.start && !timeRange?.end) return rows;
    const field = timeRange.field || mapping.dateField;
    if (!field) return rows;
    const start = timeRange.start ? Date.parse(timeRange.start) : Number.NEGATIVE_INFINITY;
    const end = timeRange.end ? Date.parse(timeRange.end) : Number.POSITIVE_INFINITY;
    return rows.filter((row) => {
      const value = Date.parse(row?.[field]);
      return Number.isFinite(value) && value >= start && value <= end;
    });
  };

  const bucketDate = (value, unit = "day") => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    if (unit === "hour") return date.toISOString().slice(0, 13);
    if (unit === "month") return date.toISOString().slice(0, 7);
    if (unit === "week") {
      const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const day = copy.getUTCDay() || 7;
      copy.setUTCDate(copy.getUTCDate() - day + 1);
      return copy.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
  };

  const transformRows = (rows = [], request = {}, context = {}) => {
    let working = cloneJson(rows);
    const mapping = request.semanticMapping || context.semanticMapping || {};
    const calculated = [...(request.calculatedFields || []), ...(request.computedFields || [])];
    if (calculated.length) {
      working = working.map((row) => {
        const next = { ...row };
        calculated.forEach((field) => {
          const name = field.name || field.field || field.key;
          if (!name || !field.expression) return;
          next[name] = evaluateExpression(field.expression, next, { ...context, rows: working, now: context.now || DEMO_NOW });
        });
        return next;
      });
    }
    if (request.unitConversions?.length) {
      working = working.map((row) => {
        const next = { ...row };
        request.unitConversions.forEach((conversion) => {
          const source = conversion.sourceField || conversion.field;
          const target = conversion.targetField || source;
          if (!source || !target) return;
          next[target] = round(numeric(next[source]) * (Number(conversion.factor) || 1), 4);
        });
        return next;
      });
    }
    if (request.thresholds?.length) {
      working = working.map((row) => {
        const next = { ...row };
        request.thresholds.forEach((rule) => {
          const target = rule.targetField || "thresholdState";
          const value = numeric(next[rule.field || mapping.valueField]);
          const warning = numeric(rule.warning ?? next.threshold ?? 0);
          const critical = numeric(rule.critical ?? warning * 1.25);
          next[target] = value >= critical ? "Critical" : value >= warning ? "Warning" : "Normal";
        });
        return next;
      });
    }
    if (request.staleRules?.length) {
      working = working.map((row) => {
        const next = { ...row };
        request.staleRules.forEach((rule) => {
          const field = rule.field || mapping.custom?.staleField || "lastUpdated";
          const target = rule.targetField || "staleState";
          const hours = (Date.parse(context.now || DEMO_NOW) - Date.parse(next[field])) / 3_600_000;
          next[target] = Number.isFinite(hours) && hours > (Number(rule.maxAgeHours) || 24) ? "Stale" : "Fresh";
        });
        return next;
      });
    }
    working = applyTimeRange(working, request.timeRange || context.timeRange, mapping);
    working = applyFilters(working, [...(context.filters || []), ...(request.filters || []), ...(request.equationFilters || [])], { ...context, rows: working, now: context.now || DEMO_NOW });

    if (request.timeBucket?.field || request.timeBucket?.unit) {
      const field = request.timeBucket.field || mapping.dateField;
      const target = request.timeBucket.targetField || "timeBucket";
      const unit = request.timeBucket.unit || "day";
      working = working.map((row) => ({ ...row, [target]: bucketDate(row[field], unit) }));
    }

    if (Array.isArray(request.groupBy) && request.groupBy.length && Array.isArray(request.aggregations) && request.aggregations.length) {
      const groups = new Map();
      working.forEach((row) => {
        const key = request.groupBy.map((field) => row?.[field] ?? "").join("|");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      });
      working = [...groups.entries()].map(([key, groupRows]) => {
        const grouped = {};
        request.groupBy.forEach((field, index) => { grouped[field] = key.split("|")[index]; });
        request.aggregations.forEach((aggregation) => {
          const name = aggregation.name || `${aggregation.op || "count"}_${aggregation.field || "rows"}`;
          grouped[name] = aggregateRows(groupRows, aggregation.field, aggregation.op || aggregation.aggregation || "count");
        });
        grouped.count = groupRows.length;
        return grouped;
      });
    }

    if (Array.isArray(request.sort) && request.sort.length) {
      working = [...working].sort((a, b) => {
        for (const rule of request.sort) {
          const direction = rule.direction === "desc" ? -1 : 1;
          const av = a?.[rule.field];
          const bv = b?.[rule.field];
          if (av === bv) continue;
          return av > bv ? direction : -direction;
        }
        return 0;
      });
    }
    const total = working.length;
    if (Number.isFinite(Number(request.limit))) working = working.slice(0, Math.max(0, Number(request.limit)));
    return { rows: working, total, schema: schemaForRows(working) };
  };

  const projectFields = (rows, fields = null) => {
    if (!Array.isArray(fields) || !fields.length) return rows;
    return rows.map((row) => fields.reduce((projected, field) => {
      projected[field] = row?.[field];
      return projected;
    }, {}));
  };

  const queryRows = (rows = [], request = {}, context = {}) => {
    const transformed = transformRows(rows, request, context);
    const projectedRows = projectFields(transformed.rows, request.fields);
    return {
      ...transformed,
      rows: projectedRows,
      schema: schemaForRows(projectedRows),
    };
  };

  const widgetDatasetKind = (widgetType = "", config = {}) => {
    if (widgetType === "map") return "sites";
    if (widgetType === "calendar") return "inspections";
    if (widgetType === "table") return config.datasetKind || "workOrders";
    if (widgetType === "filter") return "operations";
    if (widgetType === "chart") {
      if (["line", "area", "sparkline", "histogram"].includes(config.chartType)) return "sensorReadings";
      if (["pie", "donut", "gauge"].includes(config.chartType)) return "projects";
      return "financials";
    }
    return "operations";
  };

  const widgetDemoData = (widgetType = "stat", config = {}, overrides = {}) => {
    const data = generateOperationalData({ seed: overrides.seed || config.seed || "widget-demo" });
    const datasetKind = overrides.datasetKind || widgetDatasetKind(widgetType, config);
    const rows = cloneJson(overrides.rows || data.datasets[datasetKind] || data.datasets.operations);
    const semanticMapping = {
      ...semanticMappingFor(datasetKind),
      ...(overrides.semanticMapping || {}),
    };
    if (["scatter", "bubble"].includes(config.chartType)) {
      semanticMapping.dateField = "comparison";
      semanticMapping.valueField = semanticMapping.valueField || "value";
    }
    return {
      name: `${datasetKind.replace(/([A-Z])/g, " $1")} demo`,
      sourceId: overrides.sourceId || `__demo-${datasetKind}`,
      sourceName: overrides.sourceName || "Simulated operations data",
      datasetKind,
      semanticMapping,
      schema: schemaForRows(rows),
      rows,
    };
  };

  const scenarioSource = (scenario = "executive-overview", options = {}) => {
    const seed = options.seed || scenario;
    const data = generateOperationalData({ seed });
    const rowsByScenario = {
      "executive-overview": data.datasets.financials.concat(data.datasets.customers, data.datasets.sites),
      "operations-command-center": data.datasets.events.concat(data.datasets.workOrders, data.datasets.technicians, data.datasets.sensorReadings.slice(0, 96)),
      "maintenance-planning": data.datasets.assets.concat(data.datasets.inspections, data.datasets.inventory, data.datasets.projects),
      "customer-success": data.datasets.customers.concat(data.datasets.tickets, data.datasets.financials),
      "engineer-dataflow-demo": data.datasets.operations,
      "panel-containment-stress": data.datasets.operations,
      "ai-scenario-analysis": data.datasets.financials.concat(data.datasets.operations, data.datasets.projects),
      "geospatial-operations": data.datasets.sites.concat(data.datasets.technicians, data.datasets.events),
      "asset-health": data.datasets.assets.concat(data.datasets.inspections, data.datasets.sensorReadings.slice(0, 120)),
      "financial-forecasting": data.datasets.financials.concat(data.datasets.projects, data.datasets.customers),
      "alarm-analytics": data.datasets.events.concat(data.datasets.sensorReadings, data.datasets.sites),
      "live-dispatch-board": data.datasets.workOrders.concat(data.datasets.technicians, data.datasets.tickets),
      "cost-reduction-scenario": data.datasets.financials.concat(data.datasets.projects, data.datasets.customers),
      "regional-performance-analysis": data.datasets.sites.concat(data.datasets.financials, data.datasets.workOrders),
      "technician-efficiency-breakdown": data.datasets.technicians.concat(data.datasets.workOrders, data.datasets.inspections),
      "sla-risk-dashboard": data.datasets.tickets.concat(data.datasets.customers, data.datasets.workOrders),
      "revenue-projection-workspace": data.datasets.financials.concat(data.datasets.customers, data.datasets.projects),
    };
    const rows = cloneJson(rowsByScenario[scenario] || data.datasets.operations);
    return {
      id: `demo-source-${scenario}`,
      name: scenario.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
      kind: "manual",
      config: {
        rows,
        schema: schemaForRows(rows).fields,
      },
      context: {
        id: "builder:region:root",
        name: "Simulated workspace",
        dataSourceId: `demo-source-${scenario}`,
        semanticMapping: semanticMappingFor("operations"),
      },
    };
  };

  const useCaseMatrix = () => ({
    stat: {
      dataShapes: ["single value", "aggregation", "derived metric", "threshold state", "stale state"],
      transforms: ["aggregate", "calculated field", "threshold classification", "percent change"],
      emptyState: "No matching records after context/filter/time reduction.",
      errorState: "Expression, source, or required field failed.",
      useCases: ["revenue total", "open request count", "average response time", "completion percent"],
    },
    table: {
      dataShapes: ["entity list", "event log", "inventory", "work orders", "filtered results"],
      transforms: ["filter", "search", "sort", "limit", "calculated columns", "conditional fields"],
      emptyState: "No rows match current scope.",
      errorState: "Schema or transform failed.",
      useCases: ["urgent work list", "inventory shortage", "customer/account roster"],
    },
    chart: {
      dataShapes: ["time series", "category comparison", "distribution", "ratio", "progress"],
      transforms: ["group by", "aggregate", "time bucket", "top N", "derived series"],
      emptyState: "No chartable rows or required fields.",
      errorState: "Chart adapter or transform failed.",
      useCases: ["trend", "status mix", "category cost", "progress gauge"],
    },
    map: {
      dataShapes: ["point coordinates", "site list", "field positions"],
      transforms: ["coordinate mapping", "filter", "status overlay", "limit"],
      emptyState: "No valid coordinates.",
      errorState: "Location fields failed.",
      useCases: ["site map", "field coverage", "event clusters"],
    },
    filter: {
      dataShapes: ["categorical values", "date ranges", "number ranges", "text fields"],
      transforms: ["context filter emission", "search", "range reduction"],
      emptyState: "No options available from scoped rows.",
      errorState: "Filter field unavailable.",
      useCases: ["shared region filters", "panel-local filtering"],
    },
    timeframe: {
      dataShapes: ["timestamped records"],
      transforms: ["time range context", "relative presets", "fixed ranges"],
      emptyState: "No active time range.",
      errorState: "Invalid date range.",
      useCases: ["week/month/year scoping"],
    },
    calendar: {
      dataShapes: ["dated records", "scheduled work", "inspections"],
      transforms: ["date-field mapping", "time filtering", "limit"],
      emptyState: "No dated records.",
      errorState: "Date field unavailable.",
      useCases: ["inspection calendar", "planned work"],
    },
    "data-filter": {
      dataShapes: ["boolean/equation signal", "type conversion", "logical composition"],
      transforms: ["equation filter", "boolean logic", "unit conversion", "type conversion"],
      emptyState: "No incoming explicit dataflow signal.",
      errorState: "Invalid logic/configuration.",
      useCases: ["engineer underlay filter", "conversion processor"],
    },
    shift: {
      dataShapes: ["boolean signal", "threshold result"],
      transforms: ["boolean logic", "threshold classification"],
      emptyState: "No incoming signal.",
      errorState: "Signal evaluation failed.",
      useCases: ["conditional material state", "underlay signal proof"],
    },
  });

  const workspacePresets = () => ({
    "executive-overview": {
      label: "Executive Overview",
      seed: "executive-overview",
      widgets: [
        { type: "stat", title: "Revenue", config: { metric: "sum", valueField: "revenue", format: "currency" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "stat", title: "Margin", config: { metric: "avg", valueField: "progress", format: "percent" }, col: 3, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Revenue Trend", config: { chartType: "line", xField: "timestamp", yField: "revenue", aggregation: "sum", limit: 36 }, col: 1, row: 7, cols: 3, rows: 2 },
        { type: "chart", title: "Status Mix", config: { chartType: "donut", xField: "status", yField: "value", aggregation: "count" }, col: 4, row: 7, cols: 2, rows: 2 },
        { type: "map", title: "Site Coverage", col: 1, row: 9, cols: 3, rows: 2 },
        { type: "table", title: "Top Accounts", config: { columns: ["label", "segment", "revenue", "status"], sortBy: "revenue", sortDirection: "desc", limit: 20 }, col: 4, row: 9, cols: 3, rows: 2 },
      ],
    },
    "operations-command-center": {
      label: "Operations Command Center",
      seed: "operations-command-center",
      widgets: [
        { type: "filter", title: "Status Filter", col: 1, row: 6, cols: 2, rows: 2 },
        { type: "table", title: "Open Work", config: { columns: ["label", "status", "owner", "ageHours"], sortBy: "ageHours", sortDirection: "desc", limit: 30 }, col: 3, row: 6, cols: 3, rows: 3 },
        { type: "chart", title: "Sensor Trend", config: { chartType: "area", xField: "timestamp", yField: "value", aggregation: "avg", limit: 80 }, col: 1, row: 8, cols: 3, rows: 2 },
        { type: "map", title: "Field Map", col: 4, row: 9, cols: 3, rows: 2 },
      ],
    },
    "maintenance-planning": {
      label: "Maintenance Planning",
      seed: "maintenance-planning",
      widgets: [
        { type: "stat", title: "Asset Health", config: { metric: "avg", valueField: "value" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "calendar", title: "Upcoming Inspections", col: 3, row: 6, cols: 2, rows: 2 },
        { type: "table", title: "Inventory Shortage", config: { columns: ["label", "partType", "quantity", "status"], sortBy: "quantity", sortDirection: "asc", limit: 24 }, col: 1, row: 8, cols: 3, rows: 2 },
        { type: "chart", title: "Completion", config: { chartType: "gauge", xField: "label", yField: "progress", aggregation: "avg" }, col: 4, row: 8, cols: 2, rows: 2 },
      ],
    },
    "customer-success": {
      label: "Customer Success",
      seed: "customer-success",
      widgets: [
        { type: "stat", title: "Open Requests", config: { metric: "count", valueField: "ageHours" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Request Aging", config: { chartType: "histogram", xField: "ageHours", yField: "value", aggregation: "count" }, col: 3, row: 6, cols: 3, rows: 2 },
        { type: "table", title: "Accounts", config: { columns: ["label", "segment", "status", "revenue"], limit: 24 }, col: 1, row: 8, cols: 3, rows: 2 },
        { type: "text", title: "Notes", config: { body: "Use this space for account context, call notes, and follow-up planning." }, col: 4, row: 8, cols: 2, rows: 2 },
      ],
    },
    "engineer-dataflow-demo": {
      label: "Engineer Mode Dataflow Demo",
      seed: "engineer-dataflow-demo",
      engineerMode: true,
      widgets: [
        { type: "data-filter", title: "Equation Filter", config: { operator: "AND", expression: "value > threshold" }, col: 1, row: 6, cols: 2, rows: 2, layer: "backend" },
        { type: "data-filter", title: "Type Conversion", config: { filterMode: "type-conversion", sourceType: "string", targetType: "number" }, col: 3, row: 6, cols: 2, rows: 2, layer: "backend" },
        { type: "shift", title: "Threshold Shift", col: 5, row: 6, cols: 2, rows: 2 },
        { type: "context-inspector", title: "Context Inspector", col: 1, row: 8, cols: 3, rows: 2, layer: "backend" },
      ],
    },
    "panel-containment-stress": {
      label: "Panel Containment Stress",
      seed: "panel-containment-stress",
      widgets: [
        { type: "stat", title: "Panel Metric", config: { metric: "avg", valueField: "value" }, col: 1, row: 1, cols: 2, rows: 1, panel: "demo-panel-a" },
        { type: "chart", title: "Panel Trend", config: { chartType: "sparkline", xField: "timestamp", yField: "value" }, col: 1, row: 2, cols: 3, rows: 1, panel: "demo-panel-a" },
        { type: "table", title: "Panel Rows", config: { columns: ["label", "category", "status", "value"], limit: 18 }, col: 1, row: 1, cols: 3, rows: 2, panel: "demo-panel-b" },
      ],
      panels: [
        { key: "demo-panel-a", title: "Local Signals", col: 1, row: 6, cols: 3, rows: 3 },
        { key: "demo-panel-b", title: "Local Records", col: 4, row: 6, cols: 3, rows: 3 },
      ],
    },
    "ai-scenario-analysis": {
      label: "AI Scenario Analysis",
      seed: "ai-scenario-analysis",
      widgets: [
        { type: "ai-assistant", title: "Workspace Operator", config: { scope: "workspace", promptTemplate: "What changed this month?" }, col: 1, row: 6, cols: 3, rows: 4 },
        { type: "stat", title: "Projected Value", config: { metric: "sum", valueField: "revenue", format: "currency" }, col: 4, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Scenario Trend", config: { chartType: "area", xField: "timestamp", yField: "revenue", aggregation: "sum", limit: 48 }, col: 4, row: 7, cols: 3, rows: 2 },
        { type: "table", title: "Scenario Inputs", config: { columns: ["label", "category", "revenue", "cost", "status"], sortBy: "revenue", sortDirection: "desc", limit: 24 }, col: 1, row: 10, cols: 4, rows: 2 },
      ],
    },
    "geospatial-operations": {
      label: "Geospatial Operations",
      seed: "geospatial-operations",
      widgets: [
        { type: "map", title: "Coverage Map", config: { latitudeField: "latitude", longitudeField: "longitude", locationField: "location", limit: 140 }, col: 1, row: 6, cols: 4, rows: 3 },
        { type: "table", title: "Location Records", config: { columns: ["label", "location", "status", "value"], limit: 28 }, col: 5, row: 6, cols: 2, rows: 3 },
        { type: "chart", title: "Regional Mix", config: { chartType: "bar", xField: "region", yField: "value", aggregation: "avg", limit: 12 }, col: 1, row: 9, cols: 3, rows: 2 },
        { type: "stat", title: "Active Sites", config: { metric: "count" }, col: 4, row: 9, cols: 2, rows: 1 },
      ],
    },
    "asset-health": {
      label: "Asset Health View",
      seed: "asset-health",
      widgets: [
        { type: "stat", title: "Average Health", config: { metric: "avg", valueField: "value" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Condition Distribution", config: { chartType: "histogram", xField: "value", yField: "value", aggregation: "count", limit: 60 }, col: 3, row: 6, cols: 3, rows: 2 },
        { type: "calendar", title: "Inspection Plan", col: 1, row: 8, cols: 2, rows: 2 },
        { type: "table", title: "Asset Register", config: { columns: ["label", "assetType", "status", "lastUpdated", "value"], sortBy: "value", sortDirection: "asc", limit: 30 }, col: 3, row: 8, cols: 4, rows: 2 },
      ],
    },
    "financial-forecasting": {
      label: "Financial Forecasting",
      seed: "financial-forecasting",
      widgets: [
        { type: "stat", title: "Revenue", config: { metric: "sum", valueField: "revenue", format: "currency" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "stat", title: "Cost", config: { metric: "sum", valueField: "cost", format: "currency" }, col: 3, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Revenue Projection", config: { chartType: "line", xField: "timestamp", yField: "revenue", aggregation: "sum", limit: 60 }, col: 1, row: 7, cols: 4, rows: 2 },
        { type: "chart", title: "Cost Mix", config: { chartType: "donut", xField: "category", yField: "cost", aggregation: "sum", limit: 12 }, col: 5, row: 7, cols: 2, rows: 2 },
        { type: "table", title: "Forecast Inputs", config: { columns: ["label", "category", "revenue", "cost", "progress"], limit: 24 }, col: 1, row: 9, cols: 4, rows: 2 },
      ],
    },
    "alarm-analytics": {
      label: "Alarm Analytics",
      seed: "alarm-analytics",
      widgets: [
        { type: "stat", title: "Open Signals", config: { metric: "count" }, col: 1, row: 6, cols: 2, rows: 1 },
        { type: "chart", title: "Frequency Trend", config: { chartType: "area", xField: "timestamp", yField: "value", aggregation: "count", limit: 96 }, col: 3, row: 6, cols: 4, rows: 2 },
        { type: "chart", title: "Status Breakdown", config: { chartType: "bar", xField: "status", yField: "value", aggregation: "count" }, col: 1, row: 8, cols: 2, rows: 2 },
        { type: "table", title: "Signal Log", config: { columns: ["label", "status", "severity", "timestamp", "value"], sortBy: "timestamp", sortDirection: "desc", limit: 30 }, col: 3, row: 8, cols: 4, rows: 2 },
      ],
    },
    "live-dispatch-board": {
      label: "Live Dispatch Board",
      seed: "live-dispatch-board",
      widgets: [
        { type: "filter", title: "Dispatch Filter", col: 1, row: 6, cols: 2, rows: 2 },
        { type: "table", title: "Active Work", config: { columns: ["label", "owner", "status", "priority", "ageHours"], sortBy: "ageHours", sortDirection: "desc", limit: 30 }, col: 3, row: 6, cols: 4, rows: 3 },
        { type: "map", title: "Field Positions", col: 1, row: 8, cols: 2, rows: 2 },
        { type: "chart", title: "Workload", config: { chartType: "bar", xField: "owner", yField: "value", aggregation: "count", limit: 12 }, col: 1, row: 10, cols: 3, rows: 2 },
      ],
    },
  });

  window.dashboardDataTransformRuntime = {
    evaluateExpression,
    transformRows,
    queryRows,
    schemaForRows,
    semanticMappingFor,
    demoNow: DEMO_NOW,
  };

  window.dashboardDemoDataRuntime = {
    generateOperationalData,
    widgetDemoData,
    scenarioSource,
    useCaseMatrix,
    workspacePresets,
    schemaForRows,
    semanticMappingFor,
    seededRandom,
  };
})();
