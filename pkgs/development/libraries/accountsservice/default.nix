{ stdenv, fetchurl, pkgconfig, glib, intltool, makeWrapper, shadow
, libtool, gobjectIntrospection, polkit, systemd, coreutils }:

stdenv.mkDerivation rec {
  name = "accountsservice-${version}";
  version = "0.6.42";

  src = fetchurl {
    url = "http://www.freedesktop.org/software/accountsservice/accountsservice-${version}.tar.xz";
    sha256 = "0zh0kjpdc631qh36plcgpwvnmh9wj8l5cki3aw5r09w6y7198r75";
  };

  buildInputs = [ pkgconfig glib intltool libtool makeWrapper
                  gobjectIntrospection polkit systemd ];

  configureFlags = [ "--with-systemdsystemunitdir=$(out)/etc/systemd/system"
                     "--localstatedir=/var" ];
  prePatch = ''
    substituteInPlace src/daemon.c --replace '"/usr/sbin/useradd"' '"${shadow}/bin/useradd"' \
                                   --replace '"/usr/sbin/userdel"' '"${shadow}/bin/userdel"'
    substituteInPlace src/user.c   --replace '"/usr/sbin/usermod"' '"${shadow}/bin/usermod"' \
                                   --replace '"/usr/bin/chage"' '"${shadow}/bin/chage"' \
                                   --replace '"/usr/bin/passwd"' '"${shadow}/bin/passwd"' \
                                   --replace '"/bin/cat"' '"${coreutils}/bin/cat"'
  '';

  patches = [
    ./no-create-dirs.patch
    ./Add-nixbld-to-user-blacklist.patch
    ./Disable-methods-that-change-files-in-etc.patch
  ];

  preFixup = ''
    wrapProgram "$out/libexec/accounts-daemon" \
      --run "${coreutils}/bin/mkdir -p /var/lib/AccountsService/users" \
      --run "${coreutils}/bin/mkdir -p /var/lib/AccountsService/icons"
  '';

  meta = with stdenv.lib; {
    description = "D-Bus interface for user account query and manipulation";
    homepage = http://www.freedesktop.org/wiki/Software/AccountsService;
    license = licenses.gpl3;
    maintainers = with maintainers; [ pSub ];
    platforms = with platforms; linux;
  };
}
