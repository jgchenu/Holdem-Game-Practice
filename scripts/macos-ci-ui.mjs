import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync,readFileSync,readdirSync,readlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

assert.equal(process.platform,'darwin','macOS UI tests require Xcode on macOS');
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const buildOnly=process.argv.includes('--build-only');
// Local execution only compiles the runner. Never launch or replace the user's
// existing apps while the desktop is locked or their audit process is running.
if(!buildOnly)assert.equal(process.env.GITHUB_ACTIONS,'true','Native UI execution is restricted to the disposable CI host; use --build-only locally');
const output=join(root,'artifacts','macos-ci-ui');mkdirSync(output,{recursive:true});
const report={passed:false,buildOnly,sourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  sourceTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8'}).trim(),
  worktreeStatus:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),
  scope:buildOnly?'Compile the standalone macOS XCTest runner only; no app or UI launch':'Native macOS ordinary first teaching click and dealt table using XCTest on an isolated CI copy; not yet a 15-window soak'};
const save=()=>writeFileSync(join(output,'result.json'),JSON.stringify(report,null,2)+'\n');save();
try{
 if(!buildOnly){
  const app=join(output,'app','问道牌途.app');
  assert.ok(existsSync(join(root,'src-tauri','target','release','bundle','macos','问道牌途.app')),'The ordinary Tauri app must already be built');
  execFileSync('ditto',[join(root,'src-tauri','target','release','bundle','macos','问道牌途.app'),app]);
  const fingerprint=path=>{const files={};const walk=(dir,prefix='')=>{for(const e of readdirSync(dir,{withFileTypes:true})){if(e.isDirectory())walk(join(dir,e.name),prefix+e.name+'/');else if(e.isFile())files[prefix+e.name]=createHash('sha256').update(readFileSync(join(dir,e.name))).digest('hex');else if(e.isSymbolicLink())files[prefix+e.name]='symlink:'+readlinkSync(join(dir,e.name));}};walk(path);return files;};
  const original=fingerprint(join(root,'src-tauri','target','release','bundle','macos','问道牌途.app'));
  const copy=fingerprint(app);
  assert.deepEqual(copy,original,'The native UI test must launch an exact CI copy of the ordinary app');
  report.ordinaryCopy={fileCount:Object.keys(copy).length,payloadHashes:copy,source:'ordinary Tauri build app copied before native UI testing'};
  writeFileSync(join(output,'runtime.json'),JSON.stringify({ci:true,application:app},null,2)+'\n');
 }
 const resultPath=join(root,'artifacts',`macos-ui-${Date.now()}.xcresult`);
 if(!buildOnly)report.resultBundle=resultPath;
 const args=['-project','macos/PracticeUITests.xcodeproj','-scheme','PracticeUITests','-destination','platform=macOS',
  '-derivedDataPath',join(output,'DerivedData'),'CODE_SIGN_IDENTITY=-','-parallel-testing-enabled','NO',
  '-only-testing:PracticeUITests/PracticeUITests/testOrdinaryFirstTeaching',
  ...(buildOnly?['build-for-testing']:['-resultBundlePath',resultPath,'test'])];
 const child=spawnSync('xcodebuild',args,{cwd:root,stdio:'inherit'});
 report.exitCode=child.status;report.signal=child.signal;
 if(child.error)throw child.error;
 assert.equal(child.status,0,'Native macOS UI build/test must actually succeed');
 if(!buildOnly){
  report.tests=JSON.parse(execFileSync('xcrun',['xcresulttool','get','test-results','summary','--path',resultPath],{encoding:'utf8',timeout:30000}));
  assert.equal(report.tests.failedTests,0);assert.equal(report.tests.passedTests,1);
 }
 report.passed=true;
}catch(error){report.error=String(error);console.error(report.error);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();save();}
