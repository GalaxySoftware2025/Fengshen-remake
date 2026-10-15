// rosters (and bags, below) read from RAM snapshots of the original at a battle's deploy screen (tools/rom/extract.py), by battle.
// Stats are not stored: they equal the growth table at each level. ROM-derived, keep private.
window.PARTIES = {
  13: [   // 磻溪
    {"cid":0,"lv":18,"exp":89,"items":[11,0,0],"spells":[0,1,22]},
    {"cid":1,"lv":19,"exp":38,"items":[0,4],"spells":[38,44,16,51]},
    {"cid":2,"lv":19,"exp":84,"items":[0],"spells":[52,53]},
    {"cid":3,"lv":15,"exp":25,"items":[],"spells":[12]},
    {"cid":4,"lv":19,"exp":65,"items":[0,0,35,17,0,0,0,0],"spells":[22]},
    {"cid":5,"lv":18,"exp":25,"items":[],"spells":[4]},
    {"cid":6,"lv":20,"exp":1,"items":[0,0,0,14,31,0,0],"spells":[30]},
  ],
};
// the shared bag at the same moments (RAM 0xFFA000: 36 item / count pairs), item id: count
window.BAGS = {
  13: { 0: 16, 1: 7, 4: 7, 5: 1, 8: 1, 11: 2, 14: 2, 17: 1, 32: 1, 33: 15, 34: 1 },   // 磻溪
};
