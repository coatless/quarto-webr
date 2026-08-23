local tap = require("tap")

tap.eq(1 + 1, 2, "harness: numeric equality")
tap.eq("a", "a", "harness: string equality")
tap.eq({ x = 1, y = { z = 2 } }, { x = 1, y = { z = 2 } }, "harness: deep table equality")
tap.ok(true, "harness: ok() accepts truthy")
