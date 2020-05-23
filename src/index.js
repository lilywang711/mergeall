const colors = require('colors');
const simpleGit = require('simple-git/promise');
const path = require('path');
const R = require('ramda');

const fromBranch = 'master';

function Merge() {
  this.workdir = path.join(process.cwd(), '');
  this.git = simpleGit(this.workdir);
  this.conflicts = [];
  this.success = [];
  this.localBranch = [];
}

Merge.prototype.start = async function () {
  if (!(await this.git.checkIsRepo())) {
    logger(`${this.workdir} is not a git repository!`, 'error');
    process.exit(1);
  }
  await this.getLocalBranch();
  logger('start merge...');

  const allRemotesName = getRemotesName(await this.git.getRemotes());
  const allBranch = getRemoteBranch((await this.git.branch()).all);
  for (const remote of allRemotesName) {
    for (const branch of allBranch) {
      await this.mergeCode(remote, branch);
    }
  }
  this.log();
  const diff = diffBranch(this.localBranch, allBranch);
  await this.git.deleteLocalBranches(diff, true);
  logger('Merger completed', 'success');
};

Merge.prototype.mergeCode = async function (remote, branch) {
  try {
    await this.git.stash();
    await this.git.checkout(branch);
    await this.git.fetch();
    try {
      const mergeSummary = await this.git
        .silent(true)
        .mergeFromTo(fromBranch, branch);
      this.success.push({ id: path.join(remote, branch), merge: mergeSummary });
      await this.git.push(remote, branch);
    } catch (err) {
      this.conflicts.push({ id: path.join(remote, branch), merge: err.git });
      await this.git.merge(['--abort']);
      await this.git.clean('f');
    }
    await this.git.checkout(fromBranch);
  } catch (err) {
    console.log('err mergeCode', err);
  }
};

Merge.prototype.log = function () {
  printLog(logSuccess(this.success), 'success');
  printLog(logConflicts(this.conflicts), 'error');

  function logSuccess(success) {
    return R.map(
      item => `[${item.id}] has auto merged ${item.merge.merges.length} files`,
      success
    );
  }
  function logConflicts(conflicts) {
    return R.map(
      item =>
        `[${item.id}] branch has been skipped (${item.merge.conflicts.length} conflicts on merge)`,
      conflicts
    );
  }

  function printLog(logs, level = 'success') {
    return R.map(log => logger(log, level), logs);
  }
};

Merge.prototype.getLocalBranch = async function () {
  this.localBranch = (await this.git.branchLocal()).all;
};

function getRemoteBranch(allBranch) {
  return R.pipe(
    R.filter(R.startsWith('remotes')),
    R.map(branch =>
      R.pipe(R.split('/'), R.slice(2, Infinity), R.join('/'))(branch)
    )
  )(allBranch);
}

function getRemotesName(allRemotes) {
  return R.map(R.prop('name'), allRemotes);
}

function diffBranch(local = [], remote = []) {
  const notIncludes = R.flip(R.complement(R.includes));
  return R.filter(notIncludes(local), remote);
}

function logger(msg, level) {
  const mapping = {
    success: 'green',
    error: 'red'
  };
  console.log(level ? colors[mapping[level]](msg) : msg);
}
module.exports = Merge;
