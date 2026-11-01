"""Render simple code-authored 3D solids into Macofu's static sprite kit."""
import hashlib, json, math
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'wwwroot/assets/factory'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 2080, 1240
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene
s.render.engine = 'CYCLES'
s.cycles.samples = 64
s.cycles.use_denoising = True
s.render.resolution_x, s.render.resolution_y = W, H
s.render.resolution_percentage = 100
s.render.film_transparent = True
s.render.image_settings.file_format = 'PNG'
s.render.image_settings.color_mode = 'RGBA'
s.view_settings.view_transform = 'Standard'
s.world = bpy.data.worlds.new('Soft daylight')
s.world.use_nodes = True
s.world.node_tree.nodes['Background'].inputs[0].default_value = (.82,.87,.94,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value = .65
bpy.ops.object.camera_add(location=(9,-14,14))
cam = bpy.context.object
cam.rotation_euler = (Vector((0,-.5,.3))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 12.6
s.camera = cam
bpy.ops.object.light_add(type='AREA', location=(-3,-4,9))
bpy.context.object.data.energy = 650
bpy.context.object.data.shape = 'DISK'; bpy.context.object.data.size = 7

def material(name, hex_color):
 # Blender expects linear values. Converting sRGB prevents washed-out surfaces.
 rgb=[int(hex_color[i:i+2],16)/255 for i in (0,2,4)]
 linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
 m=bpy.data.materials.new(name);m.diffuse_color=(*linear,1);m.use_nodes=True
 shader=m.node_tree.nodes['Principled BSDF']
 shader.inputs['Base Color'].default_value=(*linear,1)
 shader.inputs['Roughness'].default_value=.78
 return m
floor=material('Quiet neutral plinth','e8e7df')
silver=material('Silver housings','c5d1da')
belt=material('Graphite belt','344957')
blue=material('Cobalt details','5277b7')
navy=material('Joints and recesses','263d4b')
amber=material('Customer purchase order','e4a347')
tape=material('Packing tape','f9dc9b')
red=material('Offline lamp','bd4650')
green=material('Online lamp','3c8b78')
all_art=[]
def finish(obj,name,mat,bevel=0):
 obj.name=name;obj.data.materials.append(mat)
 if bevel:
  mod=obj.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
  normal=obj.modifiers.new('Flat panel normals','WEIGHTED_NORMAL');normal.keep_sharp=True
 all_art.append(obj)
 return obj

def box(name,at,size,mat,bevel=.045):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at)
 obj=bpy.context.object;obj.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(obj,name,mat,bevel)

def cylinder(name,at,radius,depth,mat,rotation=(0,0,0)):
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=radius,depth=depth,location=at,rotation=rotation)
 return finish(bpy.context.object,name,mat,.025)

def link(name,start,end,width,mat):
 delta=Vector(end)-Vector(start)
 obj=box(name,(Vector(start)+Vector(end))/2,(width,width,delta.length),mat,.05)
 obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
 return obj

def conveyor(name,width,bottom,top,mat):
 # Union of the direct belt, queue lane and two turns on an exact grid.
 # Shared vertices and boundary-only side faces eliminate stacked modules,
 # duplicate caps and coplanar panels. The open middle remains a real hole.
 half=width/2
 xs=[-5.4,-2-half,-2+half,3-half,3+half]
 ys=[-2-half,-2+half,-half,half]
 cells={(x,y) for x in range(4) for y in range(3)
        if y==2 or (y==0 and x>=1) or (y==1 and x in (1,3))}
 vertices=[];faces=[];indices={}
 def vertex(x,y,z):
  key=(x,y,z)
  if key not in indices:
   indices[key]=len(vertices);vertices.append((xs[x],ys[y],z))
  return indices[key]
 for x,y in sorted(cells):
  corners=[(x,y),(x+1,y),(x+1,y+1),(x,y+1)]
  faces.append(tuple(vertex(a,b,top) for a,b in corners))
  faces.append(tuple(vertex(a,b,bottom) for a,b in reversed(corners)))
  for i,neighbor in enumerate([(x,y-1),(x+1,y),(x,y+1),(x-1,y)]):
   if neighbor not in cells:
    a,b=corners[i],corners[(i+1)%4]
    faces.append((vertex(*a,bottom),vertex(*b,bottom),vertex(*b,top),vertex(*a,top)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
 obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
 return finish(obj,name,mat,.025)

base=[box('One quiet floor slab',(0,-.75,-.18),(11.4,5.4,.18),floor,.14),
      conveyor('Continuous conveyor frame',1.06,.12,.31,silver),
      conveyor('Continuous belt surface',.84,.31,.4,belt)]
for x in [-1.65,-1,-.35]:
 base.append(box('Queue position mark',(x,-2,.406),(.025,.63,.008),silver,0))
api=[box('Scanner near upright',(-2.9,-.63,.85),(.23,.22,1.04),silver),
     box('Scanner far upright',(-2.9,.63,.85),(.23,.22,1.04),silver),
     box('Single scanner crossbar',(-2.9,0,1.4),(.31,1.51,.23),blue)]
robots={}
for state,elbow,wrist in [('idle',(1.05,-2.87,1.18),(1.28,-2.18,.86)),
                          ('working',(.93,-2.7,1.08),(1.02,-2.04,.64))]:
 shoulder=(1,-2.93,.45);gripper=(wrist[0],wrist[1],wrist[2]-.19)
 robots[state]=[box('Worker plinth '+state,(1,-2.93,.13),(.7,.65,.26),silver),
                cylinder('Worker base '+state,(1,-2.93,.32),.23,.2,navy),
                link('Worker lower arm '+state,shoulder,elbow,.24,silver),
                link('Worker upper arm '+state,elbow,wrist,.21,blue),
                cylinder('Worker elbow '+state,elbow,.17,.29,navy,(0,math.pi/2,0)),
                link('Worker wrist '+state,wrist,gripper,.13,navy)]
 for dx in [-.1,.1]:
  robots[state].append(box('Gripper '+state,(gripper[0]+dx,gripper[1],gripper[2]-.07),(.06,.19,.18),navy,.015))
databases={}
for state in ['offline','online']:
 # One cabinet shell with an actual empty opening between its walls.
 parts=[box('Cabinet back '+state,(4.43,0,.91),(.16,1.6,1.82),silver),
        box('Cabinet near wall '+state,(3.86,-.73,.91),(1.3,.14,1.82),silver),
        box('Cabinet far wall '+state,(3.86,.73,.91),(1.3,.14,1.82),silver),
        box('Cabinet roof '+state,(3.86,0,1.78),(1.3,1.6,.14),silver),
        box('Cabinet base '+state,(3.86,0,.16),(1.3,1.6,.22),navy),
        box('Cabinet inner back '+state,(4.32,0,.96),(.025,1.3,1.48),navy,0),
        box('Cabinet header '+state,(3.19,0,1.62),(.12,1.4,.28),blue),
        box('Power indicator '+state,(3.115,-.51,1.63),(.025,.13,.08),red if state=='offline' else green,.015)]
 if state=='offline':parts.append(box('Closed flush shutter',(3.22,0,.96),(.09,1.28,1.25),belt,.02))
 else:parts.append(box('Raised shutter',(3.22,0,1.36),(.09,1.28,.36),belt,.02))
 # Turn the loading face toward the camera, above the final belt junction.
 # Rotating the whole cabinet preserves one consistent shell in both states.
 for obj in parts:
  x,y,z=obj.location
  obj.location=(3-y,1.05+x-3.86,z)
  obj.rotation_euler.z+=math.pi/2
 databases[state]=parts
parcel=[box('Purchase order parcel',(0,0,.21),(.39,.36,.42),amber,.035),
        box('One packing tape strip',(0,0,.424),(.09,.35,.009),tape,.004)]
for obj in parcel:
 obj.location*=.84
 obj.scale=(.84,)*3

def project(p):
 bpy.context.view_layer.update()
 v=world_to_camera_view(s,cam,Vector(p));return [round(v.x*1040,2),round((1-v.y)*620,2)]
points={'sender':(-4.5,0,.4),'apiIn':(-3.35,0,.4),'api':(-2.9,0,.4),'apiOut':(-2.35,0,.4),
 'branch':(-2,0,.4),'queueIn':(-2,-2,.4),'queue':(-1,-2,.4),'worker':(1,-2,.4),
 'turn':(3,-2,.4),'dbApproach':(3,0,.4),'dbIn':(3,.41,.4),'database':(3,1.05,.4)}
manifest={'version':2,'source':'scripts/assets/render.py','geometry':'Code-authored beveled solids; one welded conveyor mesh per layer','canvas':[1040,620],
 'render':{'tool':bpy.app.version_string,'engine':'Cycles CPU','samples':64,'resolution':[W,H],
 'camera':{'location':list(cam.location),'target':[0,-.5,.3],'orthographicScale':12.6},
 'light':{'location':[-3,-4,9],'energy':650,'size':7},'colorManagement':'Standard; sRGB material colors converted to linear',
 'alpha':'straight PNG; shared grounding shadows baked into floor; no CSS shadows'},
 'anchors':{k:project(v) for k,v in points.items()},'assets':{},
 'stations':{'sender':project((-4.5,0,0)),'api':project((-2.9,0,0)),
 'queue':project((-1,-2,0)),'worker':project((1,-2.93,0)),'database':project((3,1.05,0))},
 'queueSlots':[project((x,-2,.4)) for x in [-1.65,-1,-.35]],
 'stockSlots':[project((4.6,y,0)) for y in [-1.1,-1.65,-2.2]]}

def export(name,objs,anchor,ports=None,full=False):
 for o in all_art:o.hide_render=o not in objs
 s.render.filepath=str(OUT/f'{name}.png');bpy.ops.render.render(write_still=True)
 img=Image.open(s.render.filepath)
 crop=(0,0,W,H) if full else img.getchannel('A').getbbox()
 if not crop:raise ValueError(name+' rendered empty')
 crop=(max(0,crop[0]-4),max(0,crop[1]-4),min(W,crop[2]+4),min(H,crop[3]+4))
 img=img.crop(crop);img.save(s.render.filepath,optimize=True)
 p=project(anchor)
 revision=hashlib.sha256((OUT/f'{name}.png').read_bytes()).hexdigest()[:12]
 manifest['assets'][name]={'file':f'/assets/factory/{name}.png?v={revision}','dimensions':list(img.size),
 'size':[img.width/2,img.height/2],'pivot':[round(p[0]-crop[0]/2,2),round(p[1]-crop[1]/2,2)],
 'sourceModels':[],'geometry':[o.name for o in objs],'connections':ports or {}}
 print('EXPORTED',name,flush=True)
casters=api+robots['idle']+databases['offline']
for o in casters:o.visible_camera=False
export('factory-floor',base+casters,(0,0,0),full=True)
for o in casters:o.visible_camera=True
export('intake-scanner',api,(-2.9,0,0),{'in':project(points['apiIn']),'out':project(points['apiOut'])})
for state,robot in robots.items():export('robot-'+state,robot,(1,-2.93,0),{'work':project(points['worker'])})
for state,db in databases.items():export('storage-'+state,db,(3,1.05,0),{'in':project(points['dbIn'])})
export('parcel',parcel,(0,0,0))
manifest['states']={'worker':{'paused':'robot-idle','ready':'robot-idle','working':'robot-working'},'database':{'online':'storage-online','offline':'storage-offline'}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
palette=Image.new('RGB',(8,1))
palette.putdata([(197,209,218),(52,73,87),(82,119,183),(228,163,71),(249,220,155),(232,231,223),(189,70,80),(60,139,120)])
palette.save(OUT/'palette.png')
