#!/bin/sh
#*=====================================================================*/
#*    serrano/prgm/project/hiphop/hiphop/arch/debian/makedeb.sh.in     */
#*    -------------------------------------------------------------    */
#*    Author      :  Manuel Serrano                                    */
#*    Creation    :  Sat Dec 22 05:37:50 2007                          */
#*    Last change :  Thu Apr 23 14:26:52 2020 (serrano)                */
#*    Copyright   :  2007-20 Manuel Serrano                            */
#*    -------------------------------------------------------------    */
#*    The Shell script to build the .deb for HipHop on Debian          */
#*    -------------------------------------------------------------    */
#*    Debug with "sh -x makedeb.sh"                                    */
#*=====================================================================*/

#*---------------------------------------------------------------------*/
#*    Global configuration                                             */
#*---------------------------------------------------------------------*/
VERSION=0.3.0    # Hiphop major version e.g. VERSION=0.3.0
MINOR=        # Hiphop minor release e.g. MINOR=-pre1

SOFILEDIR=/usr/local/lib/3.3.0/so/hop/3.3.0/0789b20931ecad27ea8ca35f25504db4/linux-x86_64

AUTHOR="Manuel.Serrano@inria.fr"
LICENSE=gpl
BUILDDIR=`pwd`/build.hiphop
BASEDIR=`dirname $0`
PREFIX=`hop --configure --node_modules`
HIPHOPCONFIGUREOPT=

HOPREPOSITORY=/home/serrano/prgm/distrib

debformat="3.0 (quilt)"
fakeroot=fakeroot
sign=
targetdir=$PWD
postinstall=yes

while : ; do
  case $1 in
    "")
      break;;
    -h|--help)
      echo "usage makedeb.sh opt1 opt2 ...";
      exit 1;;
    --fakeroot)
      shift;
      fakeroot=$1;;
    --version=*)
      VERSION="`echo $1 | sed 's/^[^=]*=//'`";
      shift;;
    --minor=*)
      MINOR="`echo $1 | sed 's/^[^=]*=//'`";
      shift;;
    -O)
      shift
      BUILDDIR=$1;;
    --repodir)
      shift
      REPODIR=$1;;
    --no-install)
      shift
      postinstall=no;;
    --no-sign)
      sign=--no-sign;;
    --yes-or-no=*)
      ;;
    *)
      HIPHOPCONFIGUREOPT="$1 $HIPHOPCONFIGUREOPT";;

  esac
  shift
done

#*---------------------------------------------------------------------*/
#*    Create the BUILDDIR directories                                  */
#*---------------------------------------------------------------------*/
/bin/rm -rf $BUILDDIR
mkdir -p $BUILDDIR

#*---------------------------------------------------------------------*/
#*    Untar the hiphop version                                         */
#*---------------------------------------------------------------------*/
if [ "$REPODIR " != " " -a -f $REPODIR/hiphop-$VERSION$MINOR.hz ]; then
  tar xfz $REPODIR/hiphop-$VERSION$MINOR.hz -C $BUILDDIR || exit 1
elif [ -f $HOPREPOSITORY/hiphop-$VERSION$MINOR.hz ]; then
  tar xfz $HOPREPOSITORY/hiphop-$VERSION$MINOR.hz -C $BUILDDIR || exit 1
elif [ "$REPODIR " != " " ]; then
  echo "*** ERROR: Cannot find $REPODIR/hiphop-$VERSION$MINOR.hz"
  exit 1
else
  echo "*** ERROR: Cannot find $HOPREPOSITORY/hiphop-$VERSION$MINOR.hz"
  exit 1
fi

#*---------------------------------------------------------------------*/
#*    The debian configuration                                         */
#*---------------------------------------------------------------------*/
case `cat /etc/issue | awk '{ print $1 }'` in
  Debian)
    debian=debian;;
  Ubuntu)
    debian=ubuntu;;
  *)
    debian=debian;;
esac

debianversion=$debian
extradepend=
extrabuilddepend=

# copyright
cp $BUILDDIR/hiphop-$VERSION/LICENSE $BUILDDIR/hiphop-$VERSION/copyright

#*---------------------------------------------------------------------*/
#*    Create the .tar.gz file used for building the package            */
#*---------------------------------------------------------------------*/
tar cfz $BUILDDIR/hiphop-$VERSION.tar.gz -C $BUILDDIR hiphop-$VERSION

#*---------------------------------------------------------------------*/
#*    Start creating the .deb                                          */
#*---------------------------------------------------------------------*/
(cd $BUILDDIR/hiphop-$VERSION &&
 dh_make -y -c $LICENSE -s -e $AUTHOR -f ../hiphop-$VERSION.tar.gz) || exit $?

# changelog
cp $BUILDDIR/hiphop-$VERSION/ChangeLog $BUILDDIR/hiphop-$VERSION/debian/changelog

# debian specific
for p in control rules postinst compat; do
  if [ -f $BASEDIR/$p.in ]; then
    cat $BASEDIR/$p.in \
      | sed -e "s/3.3.0/$VERSION/g" \
            -e "s/@HIPHOPCONFIGUREOPT@/$HIPHOPCONFIGUREOPT/g" \
            -e "s/@DEBIAN@/$debian/g" \
            -e "s/@EXTRADEPEND@/$extradepend/g" \
            -e "s/@EXTRABUILDDEPEND@/$extrabuilddepend/g" \
            -e "s|@PREFIX@|$PREFIX|g" \
	    -e "s|@SOFILEDIR@|$SOFILEDIR|" \
            -e "s/@BIGLOOVERSION@/$BIGLOOVERSION/g" > \
      $BUILDDIR/hiphop-$VERSION/debian/$p;
  else
    cp $BASEDIR/$p $BUILDDIR/hiphop-$VERSION/debian;
  fi
done

mkdir -p debian/source
echo $debformat > debian/source/format

# build the package
(cd $BUILDDIR/hiphop-$VERSION && dpkg-buildpackage -r$fakeroot $sign)

# adjust the package file name
if [ "$MINOR " != " " ]; then
  minor=`echo $MINOR | sed -e "s/-//"`
  for p in $BUILDDIR/hiphop_"$VERSION"_*.deb; do
    np=`echo $p | sed -e "s/${VERSION}/${VERSION}${minor}/"`
    mv $p $np
  done
fi

# install new packages
if [ "$postinstall " = "yes " ]; then
  pkgs=`grep Package: $BUILDDIR/hiphop-$VERSION/debian/control | awk -F: '{print $2}' | sed 's/^ //g'`
  arch=`dpkg --print-architecture`

  for p in $pkgs; do
    sudo dpkg -i $BUILDDIR/${p}_$VERSION-1_$arch.deb
  done
fi

echo "Done generating .deb files  in directory \"$BUILDDIR\""
