require('colors');
const simpleGit = require('simple-git/promise');
const path = require('path');
const R = require('ramda');

const fromBranch = 'master';

module.exports = async function main() {
  const workdir = path.join(process.cwd(), '');
  const git = simpleGit(workdir);

  if (!(await git.checkIsRepo())) {
    console.log(`${workdir} 不是 git 仓库！`.red);
    process.exit(1);
  }

  const allRemotesName = getRemotesName(await git.getRemotes());
  const allBranch = getRemoteBranch((await git.branch()).all);
  for (const remote of allRemotesName) {
    for (const branch of allBranch) {
      await mergeCode(git, remote, branch);
    }
  }
};

function getRemoteBranch(allBranch) {
  return R.pipe(
    R.filter(R.startsWith('remotes')),
    R.map(branch =>
      R.pipe(R.split('/'), R.slice(2, Infinity), R.join('/'))(branch)
    )
  )(allBranch);
}

async function mergeCode(git, remote, branch) {
  try {
    console.log('remote', remote, branch);
    await git.stash();
    await git.checkout(branch);
    await git.fetch();
    try {
      const mergeSummary = await git
        .silent(true)
        .mergeFromTo(fromBranch, branch);
      console.log(`Merged ${mergeSummary.merges.length} files`);
      // await git.push(remote, branch);
    } catch (err) {
      console.error(`Merge resulted in ${err.git.conflicts.length} conflicts`);
      await git.merge(['--abort']);
      await git.clean('f');
    }
    await git.checkout(fromBranch);
  } catch (err) {
    console.log('err mergeCode', err);
  }
}

function getRemotesName(allRemotes) {
  return R.map(R.prop('name'), allRemotes);
}

function Merge() {
  this.conflicts = [];
  this.branch = [];
}
function getLocalBranch() {}
function diffBranch() {}
