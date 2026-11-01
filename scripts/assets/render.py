"""Render Kenney sources with Blender (bpy) into the static Macofu sprite kit."""
import json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/kenney-factory-kit'
OUT = ROOT / 'wwwroot/assets/factory'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 2080, 1240
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene
s.render.engine = 'CYCLES'
s.cycles.samples = 24
s.cycles.use_denoising = True
s.render.resolution_x, s.render.resolution_y = W, H
s.render.resolution_percentage = 100
s.render.film_transparent = True
s.render.image_settings.file_format = 'PNG'
s.render.image_settings.color_mode = 'RGBA'
s.view_settings.view_transform = 'Standard'
s.world = bpy.data.worlds.new('Cream studio')
s.world.use_nodes = True
s.world.node_tree.nodes['Background'].inputs[0].default_value = (.78,.84,.9,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value = .65
bpy.ops.object.camera_add(location=(9,-14,14))
cam = bpy.context.object
cam.rotation_euler = (Vector((0,-.5,.3))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 12.6
s.camera = cam
bpy.ops.object.light_add(type='AREA', location=(-3,-4,9))
bpy.context.object.data.energy = 1250
bpy.context.object.data.shape = 'DISK'; bpy.context.object.data.size = 5

def material(name, color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
 m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.72
 return m
cream=material('Cream floor',(.94,.85,.66)); cream2=material('Cream floor alternate',(.89,.80,.62))
# Map the publisher's color swatches without changing any authored mesh or UVs.
im=Image.open(SOURCE/'colormap.png').convert('RGBA')
def recolor(p):
 r,g,b,a=p
 if r==g==b==0:return p
 if max(r,g,b)-min(r,g,b)<20:return (0,48,73,a) if r<140 else (253,240,213,a)
 if r>g*1.15 and r>b*1.1:return (193,18,31,a) if r>220 else (120,0,0,a)
 if g>r*1.2:return (102,155,188,a)
 if b>r*1.05:return (102,155,188,a) if r>105 else (0,48,73,a)
 return (253,240,213,a)
im.putdata([recolor(p) for p in im.get_flattened_data()]);im.save(OUT/'palette.png')
texture=bpy.data.images.load(str(OUT/'palette.png'))
all_art=[]
def model(name, at=(0,0,0), rotation=0, scale=1, pose=None):
 bpy.ops.import_scene.gltf(filepath=str(SOURCE/'models'/f'{name}.glb'))
 objs=list(bpy.context.selected_objects);root=next(o for o in objs if o.parent is None)
 root.rotation_mode='XYZ';root.location=at;root.rotation_euler.z=rotation;root.scale=(scale,)*3
 if pose:
  for o in objs:
   for joint,angle in pose.items():
    if o.name.split('.')[0]==joint:
     o.rotation_mode='XYZ';o.rotation_euler.y=math.radians(angle)
 for o in objs:
  if o.type=='MESH':
   for mat in o.data.materials:
    if mat and mat.use_nodes:
     for node in mat.node_tree.nodes:
      if node.type=='TEX_IMAGE':node.image=texture;node.interpolation='Closest'
 all_art.extend(objs)
 return objs

def project(p):
 bpy.context.view_layer.update()
 v=world_to_camera_view(s,cam,Vector(p));return [round(v.x*1040,2),round((1-v.y)*620,2)]

# Physical layout is in source-model metres. All UI anchors and paths derive from it.
points={'sender':(-4.5,0,.4),'apiIn':(-3.35,0,.4),'api':(-2.9,0,.4),'apiOut':(-2.35,0,.4),
 'branch':(-2,0,.4),'queueIn':(-2,-2,.4),'queue':(-1,-2,.4),'worker':(1,-2,.4),
 'turn':(3,-2,.4),'dbIn':(3,0,.4),'database':(3.7,0,.4)}
manifest={'version':1,'source':'https://kenney.nl/assets/factory-kit','canvas':[1040,620],
 'render':{'tool':bpy.app.version_string,'engine':'Cycles CPU','samples':24,'resolution':[W,H],
 'camera':{'location':list(cam.location),'target':[0,-.5,.3],'orthographicScale':12.6},
 'light':{'location':[-3,-4,9],'energy':1250,'size':5},'colorManagement':'Standard','alpha':'straight PNG; shared grounding shadows baked into floor; no CSS shadows'},
 'anchors':{k:project(v) for k,v in points.items()},'assets':{},
 'stations':{ 'sender':project((-4.5,0,0)), 'api':project((-2.9,0,0)),
 'queue':project((-1,-2,0)), 'worker':project((1,-2.9,0)), 'database':project((3.7,0,0))},
 'queueSlots':[project((x,-2,.4)) for x in [-1.65,-1,-.35]],
 'stockSlots':[project((3.7,y,.12)) for y in [-.2,.3,.8]]}

def export(name,objs,anchor,source,ports=None,full=False):
 for o in all_art:o.hide_render=o not in objs
 s.render.filepath=str(OUT/f'{name}.png')
 bpy.ops.render.render(write_still=True)
 img=Image.open(s.render.filepath)
 box=(0,0,W,H) if full else img.getchannel('A').getbbox()
 if not box:raise ValueError(name+' rendered empty')
 # Four physical pixels of stable transparent padding; pivot preserves ground after trimming.
 box=(max(0,box[0]-4),max(0,box[1]-4),min(W,box[2]+4),min(H,box[3]+4))
 img=img.crop(box);img.save(s.render.filepath,optimize=True)
 p=project(anchor)
 manifest['assets'][name]={'file':f'/assets/factory/{name}.png','dimensions':list(img.size),
 'size':[img.width/2,img.height/2],'pivot':[round(p[0]-box[0]/2,2),round(p[1]-box[1]/2,2)],
 'sourceModels':source,'connections':ports or {}}
 print('EXPORTED',name,flush=True)

base=[]
for x in range(-6,6):
 for y in range(-4,3):
  tile=model('floor',(x,y,-.035))
  for o in tile:
   if o.type=='MESH':o.data.materials.clear();o.data.materials.append(cream if (x+y)%2 else cream2)
  base+=tile
for x in [-5,-4,-3,-1,0,1,2,3]:base+=model('conveyor-bars',(x,0,0))
for y in [-1]:base+=model('conveyor-bars',(-2,y,0),math.pi/2)
for x in [-1,0,1,2]:base+=model('conveyor-bars',(x,-2,0))
base+=model('conveyor-bars',(3,-1,0),math.pi/2)
# Authored junctions/corners replace the underlying straight segment at the turns.
for pos,kind,rotation in [((-2,0,0),'conveyor-junction-t',0),((-2,-2,0),'conveyor-corner',0),((3,-2,0),'conveyor-corner',math.pi/2)]:
 base+=model(kind,pos,rotation)
# Bake station grounding shadows into the common floor once. Camera-invisible
# casters preserve soft physical shadows without a noisy transparent catcher plane.
api=model('scanner-high',(-2.9,0,0))
robots={}
for state,pose in [('idle',{'element-b':-30,'element-d':-55,'element-f':-65}),('working',{'element-b':-55,'element-d':-45,'element-f':-80})]:
 robots[state]=model('robot-arm-a',(1,-2.9,0),-math.pi/2,.67,pose)
databases={}
for state,door in [('online','door-wide-open'),('offline','door-wide-closed')]:
 databases[state]=model('structure-doorway-wide',(3.9,0,0),-math.pi/2,.8)+model(door,(3.9,0,0),-math.pi/2,.8)
casters=api+robots['idle']+databases['offline']
for o in casters:o.visible_camera=False
export('factory-floor',base+casters,(0,0,0),['floor','conveyor-bars','conveyor-corner','conveyor-junction-t','scanner-high','robot-arm-a','structure-doorway-wide','door-wide-closed'],full=True)
for o in casters:o.visible_camera=True
export('intake-scanner',api,(-2.9,0,0),['scanner-high'],{'in':project(points['apiIn']),'out':project(points['apiOut'])})
for state,robot in robots.items():
 export('robot-'+state,robot,(1,-2.9,0),['robot-arm-a'],{'work':project(points['worker'])})
for state,db in databases.items():
 export('storage-'+state,db,(3.7,0,0),['structure-doorway-wide','door-wide-'+('open' if state=='online' else 'closed')],{'in':project(points['dbIn'])})
parcel=model('box-small',(0,0,0),scale=.72)
export('parcel',parcel,(0,0,0),['box-small'])
manifest['states']={'worker':{'paused':'robot-idle','ready':'robot-idle','working':'robot-working'},'database':{'online':'storage-online','offline':'storage-offline'}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
