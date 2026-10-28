"""Owner account and database operations against root-approved targets only."""
import base64
import json
import os
from pathlib import Path
import re
import subprocess
import time

ACTIONS = {'STATUS','USER_LIST','USER_CREATE','USER_UPDATE','DB_STOP','DB_START','DEMO_SEED','DEMO_RESET'}
REGISTRY = Path(os.environ.get('OWNER_TARGETS_PATH','/etc/sunny-smile/owner-targets.json'))
PRIVATE_KEY = Path(os.environ.get('OWNER_USER_PRIVATE_KEY','/etc/sunny-smile/owner-user-private.pem'))
HERE = Path(__file__).resolve().parent
ROLES = {'dental-erp':{'ADMIN','DOCTOR','RECEPTIONIST','LAB_TECH','ACCOUNTANT'},'clinic-cms':{'admin','doctor','receptionist','cashier'}}
IDENT = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
CONTAINER = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$')

class OwnerOperationError(RuntimeError):pass

def target_for(installation):
    try:
        stat=REGISTRY.stat()
        if stat.st_uid != os.geteuid() or stat.st_mode & 0o022:
            raise OwnerOperationError('Owner target registry permissions are unsafe')
        target=json.loads(REGISTRY.read_text())[installation['id']]
    except (OSError,ValueError,KeyError,TypeError) as exc:
        raise OwnerOperationError('Installation is not registered for owner account/database controls') from exc
    if target.get('hostname') != installation.get('hostname') or target.get('productKey') != installation.get('productKey'):
        raise OwnerOperationError('Owner installation binding mismatch')
    if target.get('productKey') not in ROLES or not IDENT.fullmatch(target.get('tenantId','')):
        raise OwnerOperationError('Invalid owner tenant binding')
    for key in ('appContainer','databaseContainer'):
        value=target.get(key,'')
        if not CONTAINER.fullmatch(value) or value.startswith(('product-control','dental-saas')):
            raise OwnerOperationError('Invalid owner container binding')
    if target['appContainer']==target['databaseContainer']:
        raise OwnerOperationError('Database and application bindings must differ')
    return target

def validate(job):
    target=target_for(job.get('installation',{}))
    action=job.get('action');payload=job.get('request')
    if action not in ACTIONS or not isinstance(payload,dict) or payload.get('action')!=action:
        raise OwnerOperationError('Invalid owner operation')
    fields={'action'}
    if action not in {'STATUS','USER_LIST'}:
        if not isinstance(payload.get('reason'),str) or not 3<=len(payload['reason'])<=500:
            raise OwnerOperationError('Audit reason required')
        fields.add('reason')
    if action=='USER_CREATE':
        fields|={'name','email','role','encryptedPassword'}
        if not isinstance(payload.get('name'),str) or not 2<=len(payload['name'])<=120:
            raise OwnerOperationError('Invalid user name')
        if not isinstance(payload.get('email'),str) or len(payload['email'])>255 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',payload['email']):
            raise OwnerOperationError('Invalid user email')
        if not isinstance(payload.get('encryptedPassword'),str) or not 100<=len(payload['encryptedPassword'])<=1400:
            raise OwnerOperationError('Encrypted credential required')
    if action=='USER_UPDATE':
        fields|={'userId','role','isActive'}
        if not isinstance(payload.get('userId'),str) or not IDENT.fullmatch(payload['userId']):
            raise OwnerOperationError('Invalid user ID')
        if 'isActive' in payload and not isinstance(payload['isActive'],bool):
            raise OwnerOperationError('Invalid account status')
        if not ({'role','isActive'} & payload.keys()):
            raise OwnerOperationError('No account change specified')
    if 'role' in payload and payload['role'] not in ROLES[target['productKey']]:
        raise OwnerOperationError('Unsupported product role')
    if action=='USER_CREATE' and 'role' not in payload:
        raise OwnerOperationError('User role required')
    if action=='DB_STOP':
        fields.add('confirmHostname')
        if payload.get('confirmHostname')!=target['hostname']:
            raise OwnerOperationError('Exact hostname confirmation required')
    if action in {'DEMO_SEED','DEMO_RESET'} and target['productKey']!='dental-erp':
        raise OwnerOperationError('Demo data controls are available only for Dental ERP installations')
    if payload.keys()-fields:
        raise OwnerOperationError('Unexpected owner operation fields')
    if not isinstance(job.get('id'),str) or not IDENT.fullmatch(job['id']):
        raise OwnerOperationError('Invalid operation ID')
    return {**job,'ownerTarget':target}

def run(args, *, data=None, timeout=90):
    return subprocess.run(args,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,timeout=timeout).stdout

def container_state(name):
    data=json.loads(run(['docker','inspect','--format','{{json .State}}',name]))
    return {'running':bool(data.get('Running')),'health':data.get('Health',{}).get('Status')}

def database_status(target):
    state=container_state(target['databaseContainer'])
    return {'databaseRunning':state['running'],'databaseHealth':state['health'],'message':'Database running' if state['running'] else 'Database stopped; clinic application offline'}

def decrypt(value):
    try:
        cipher=base64.b64decode(value,validate=True)
        if not 256<=len(cipher)<=1024:raise ValueError('Invalid cipher')
        return run(['openssl','pkeyutl','-decrypt','-inkey',str(PRIVATE_KEY),'-pkeyopt','rsa_padding_mode:oaep','-pkeyopt','rsa_oaep_md:sha256','-pkeyopt','rsa_mgf1_md:sha256'],data=cipher).decode()
    except (ValueError,UnicodeError,subprocess.SubprocessError) as exc:
        raise OwnerOperationError('Unable to decrypt account credential') from exc

def execute(job):
    target=job['ownerTarget'];action=job['action'];payload=job['request']
    if action=='STATUS':return database_status(target)
    if action=='DB_STOP':
        run(['docker','stop','--time','60',target['databaseContainer']],timeout=90)
        result=database_status(target)
        if result['databaseRunning']:raise OwnerOperationError('Database did not stop')
        return result
    if action=='DB_START':
        run(['docker','start',target['databaseContainer']])
        for _ in range(45):
            state=container_state(target['databaseContainer'])
            if state['running'] and state['health'] in {None,'healthy'}:return database_status(target)
            time.sleep(2)
        raise OwnerOperationError('Database started but is not healthy; inspect installation')
    if not container_state(target['databaseContainer'])['running']:
        raise OwnerOperationError('Start the clinic database before managing clinic data')
    if action in {'DEMO_SEED','DEMO_RESET'}:
        data={'action':action,'tenantId':target['tenantId'],'operationId':job['id']}
        try:
            output=run(
                ['docker','exec','-i','-w','/app',target['appContainer'],'node','-e',(HERE/'dental_demo_data.cjs').read_text()],
                data=json.dumps(data).encode(),timeout=180
            )
        except subprocess.CalledProcessError as exc:
            message=exc.stderr.decode(errors='replace').strip()
            safe={'Clinic binding not found','Demo data operation failed','Demo data reset failed','Demo data seed failed'}
            if message not in safe:message='Demo data operation failed'
            raise OwnerOperationError(message) from None
        if len(output)>512_000:raise OwnerOperationError('Unexpected demo data result size')
        return json.loads(output)
    data={k:v for k,v in payload.items() if k in {'action','name','email','role','userId','isActive'}}
    data.update(tenantId=target['tenantId'],operationId=job['id'])
    if action=='USER_CREATE':
        credential=decrypt(payload['encryptedPassword'])
        if target['productKey']=='dental-erp':
            if not re.fullmatch(r'\$2[aby]\$12\$[./A-Za-z0-9]{53}',credential):
                raise OwnerOperationError('Invalid password hash format')
            data['passwordHash']=credential
        else:
            if not 12<=len(credential)<=256:raise OwnerOperationError('Invalid password format')
            data['password']=credential
    if target['productKey']=='dental-erp':
        command=['node','-e',(HERE/'dental_users.cjs').read_text()]
    else:
        command=['python','-c',(HERE/'clinic_users.py').read_text()]
    try:
        output=run(['docker','exec','-i','-w','/app',target['appContainer'],*command],data=json.dumps(data).encode())
    except subprocess.CalledProcessError as exc:
        # Adapters deliberately return only sanitized, credential-free errors.
        message=exc.stderr.decode(errors='replace').strip()
        safe={'Email already exists','Clinic binding not found','Unsupported role','User not found in this clinic','Keep at least one active clinic administrator','Clinic account schema validation failed','User operation failed; check product schema compatibility','User operation failed: duplicate email or unavailable account schema'}
        if message not in safe and not re.fullmatch(r'User operation failed \(P[0-9]{4}\)',message):
            message='Clinic user operation failed; check product compatibility'
        raise OwnerOperationError(message) from None
    if len(output)>512_000:raise OwnerOperationError('Unexpected account result size')
    return json.loads(output)
