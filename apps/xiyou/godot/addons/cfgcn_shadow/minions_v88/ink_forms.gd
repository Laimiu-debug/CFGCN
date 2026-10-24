extends RefCounted
## Code-native paper/stone shapes; no new bitmap or model generation.
var shapes={}
var building=[]
func polygon(points: Array,paint: int,depth=0.) -> void:
	var source=PackedVector2Array(points);var indices=Geometry2D.triangulate_polygon(source)
	for index in indices:building[paint].append(Vector3(source[index].x,source[index].y,depth))
func stroke(points: Array,width: float,paint: int,depth=0.) -> void:
	for i in range(1,points.size()):
		var a: Vector2=points[i-1];var b: Vector2=points[i];var delta=b-a
		if delta.length_squared()<.000001:continue
		var side=Vector2(-delta.y,delta.x).normalized()*width*.5
		polygon([a-side,b-side,b+side,a+side],paint,depth)
func get_shape(name: String) -> Array:
	if shapes.has(name):return shapes[name]
	building=[PackedVector3Array(),PackedVector3Array(),PackedVector3Array(),PackedVector3Array()]
	if name=="stone":
		var edge=[Vector2(-.22,-.10),Vector2(-.24,.055),Vector2(-.12,.195),Vector2(.075,.18),Vector2(.23,.045),Vector2(.18,-.13),Vector2(-.02,-.205)]
		polygon(edge,0);polygon(edge.map(func(p):return p*.84),3,.004)
		polygon([Vector2(-.13,.065),Vector2(-.08,.14),Vector2(.07,.13),Vector2(.15,.04),Vector2(.03,.075)],1,.007)
		stroke([Vector2(-.03,-.14),Vector2(.005,-.055),Vector2(-.04,.025),Vector2(.055,.07)],.021,0,.009)
		stroke([Vector2(.005,-.055),Vector2(.10,-.035),Vector2(.13,-.08)],.016,0,.010)
	elif name=="talisman":
		polygon([Vector2(-.15,-.30),Vector2(.15,-.30),Vector2(.15,.205),Vector2(.06,.30),Vector2(-.15,.30)],0)
		polygon([Vector2(-.125,-.275),Vector2(.125,-.275),Vector2(.125,.195),Vector2(.05,.275),Vector2(-.125,.275)],1,.004)
		polygon([Vector2(.05,.275),Vector2(.05,.195),Vector2(.125,.195)],3,.008)
		stroke([Vector2(.045,.275),Vector2(.045,.19),Vector2(.125,.19)],.012,0,.010)
		stroke([Vector2(-.065,.19),Vector2(.025,.19),Vector2(-.015,.12),Vector2(.055,.065),Vector2(-.05,.005),Vector2(.04,-.06),Vector2(-.035,-.13),Vector2(.015,-.205)],.025,2,.010)
		for y in [.095,-.045,-.145]:stroke([Vector2(-.075,y),Vector2(.07,y-.015)],.018,2,.011)
	shapes[name]=building;return building
